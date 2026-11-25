"""Drive the real Windows console transport without opening a desktop window."""
import argparse
import ctypes as c
from ctypes import wintypes as w
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time

parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['chat', 'signal', 'logs'], default='chat')
parser.add_argument('command', nargs=argparse.REMAINDER)
options = parser.parse_args()
command = options.command[1:] if options.command[:1] == ['--'] else options.command
if os.name != 'nt' or not command:
    raise RuntimeError('A Windows command is required')
kernel = c.WinDLL('kernel32', use_last_error=True)


class Coord(c.Structure):
    _fields_ = [('X', c.c_short), ('Y', c.c_short)]


class Startup(c.Structure):
    _fields_ = [('cb', w.DWORD), ('reserved', w.LPWSTR), ('desktop', w.LPWSTR), ('title', w.LPWSTR),
                ('x', w.DWORD), ('y', w.DWORD), ('width', w.DWORD), ('height', w.DWORD),
                ('xchars', w.DWORD), ('ychars', w.DWORD), ('fill', w.DWORD), ('flags', w.DWORD),
                ('show', w.WORD), ('reserved_size', w.WORD), ('reserved_bytes', c.c_void_p),
                ('input', w.HANDLE), ('output', w.HANDLE), ('error', w.HANDLE)]


class StartupEx(c.Structure):
    _fields_ = [('startup', Startup), ('attributes', c.c_void_p)]


class ProcessInfo(c.Structure):
    _fields_ = [('process', w.HANDLE), ('thread', w.HANDLE), ('pid', w.DWORD), ('tid', w.DWORD)]


def bind(name, result, arguments):
    function = getattr(kernel, name)
    function.restype, function.argtypes = result, arguments
    return function


create_pipe = bind('CreatePipe', w.BOOL, [c.POINTER(w.HANDLE), c.POINTER(w.HANDLE), c.c_void_p, w.DWORD])
create_console = bind('CreatePseudoConsole', c.c_long, [Coord, w.HANDLE, w.HANDLE, w.DWORD, c.POINTER(w.HANDLE)])
resize = bind('ResizePseudoConsole', c.c_long, [w.HANDLE, Coord])
close_console = bind('ClosePseudoConsole', None, [w.HANDLE])
close_handle = bind('CloseHandle', w.BOOL, [w.HANDLE])
get_standard = bind('GetStdHandle', w.HANDLE, [w.DWORD])
set_standard = bind('SetStdHandle', w.BOOL, [w.DWORD, w.HANDLE])
set_control_handler = bind('SetConsoleCtrlHandler', w.BOOL, [c.c_void_p, w.BOOL])
attach_console = bind('AttachConsole', w.BOOL, [w.DWORD])
free_console = bind('FreeConsole', w.BOOL, [])
generate_control = bind('GenerateConsoleCtrlEvent', w.BOOL, [w.DWORD, w.DWORD])
read = bind('ReadFile', w.BOOL, [w.HANDLE, c.c_void_p, w.DWORD, c.POINTER(w.DWORD), c.c_void_p])
write = bind('WriteFile', w.BOOL, [w.HANDLE, c.c_void_p, w.DWORD, c.POINTER(w.DWORD), c.c_void_p])
initialize = bind('InitializeProcThreadAttributeList', w.BOOL, [c.c_void_p, w.DWORD, w.DWORD, c.POINTER(c.c_size_t)])
update = bind('UpdateProcThreadAttribute', w.BOOL, [c.c_void_p, w.DWORD, c.c_size_t, c.c_void_p, c.c_size_t, c.c_void_p, c.c_void_p])
delete_attributes = bind('DeleteProcThreadAttributeList', None, [c.c_void_p])
create_process = bind('CreateProcessW', w.BOOL, [w.LPCWSTR, w.LPWSTR, c.c_void_p, c.c_void_p, w.BOOL, w.DWORD, c.c_void_p, w.LPCWSTR, c.POINTER(StartupEx), c.POINTER(ProcessInfo)])
wait_process = bind('WaitForSingleObject', w.DWORD, [w.HANDLE, w.DWORD])
exit_code = bind('GetExitCodeProcess', w.BOOL, [w.HANDLE, c.POINTER(w.DWORD)])


def checked(ok):
    if not ok:
        raise c.WinError(c.get_last_error())


input_read, input_write, output_read, output_write, console = [w.HANDLE() for _ in range(5)]
checked(create_pipe(c.byref(input_read), c.byref(input_write), None, 0))
checked(create_pipe(c.byref(output_read), c.byref(output_write), None, 0))
if create_console(Coord(120, 40), input_read, output_write, 0, c.byref(console)) != 0:
    raise RuntimeError('CreatePseudoConsole failed')
size = c.c_size_t()
initialize(None, 1, 0, c.byref(size))
storage = c.create_string_buffer(size.value)
checked(initialize(storage, 1, 0, c.byref(size)))
checked(update(storage, 0, 0x00020016, console, c.sizeof(console), None, None))
startup = StartupEx()
startup.startup.cb = c.sizeof(startup)
startup.attributes = c.cast(storage, c.c_void_p)
info = ProcessInfo()
output = []
write_lock = threading.Lock()


def send(text):
    data = text.encode('utf-8')
    count = w.DWORD()
    with write_lock:
        checked(write(input_write, c.create_string_buffer(data), len(data), c.byref(count), None))


def drain():
    buffer, count = c.create_string_buffer(16384), w.DWORD()
    while read(output_read, buffer, len(buffer), c.byref(count), None) and count.value:
        chunk = buffer.raw[:count.value]
        output.append(chunk)
        if b'\x1b[6n' in chunk:
            send('\x1b[1;1R')


def text():
    return re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', b''.join(output).decode('utf-8', 'replace'))


def until(needle, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if needle in text():
            return
        if wait_process(info.process, 0) == 0:
            break
        time.sleep(0.03)
    raise AssertionError(f'Console did not show {needle!r}: {text()[-2000:]}')


reader = threading.Thread(target=drain, daemon=True)
reader.start()
try:
    line = c.create_unicode_buffer(subprocess.list2cmdline(command))
    # A redirected parent otherwise passes its pipes instead of the pseudoconsole handles.
    inherited = [(kind, get_standard(kind)) for kind in [-10, -11, -12]]
    try:
        # Detached test runners may carry the inheritable ignore-Ctrl+C flag.
        checked(set_control_handler(None, False))
        for kind, _ in inherited:
            checked(set_standard(kind, None))
        checked(create_process(command[0], line, None, None, False, 0x00080000, None, os.getcwd(), c.byref(startup), c.byref(info)))
    finally:
        for kind, handle in inherited:
            checked(set_standard(kind, handle))
    close_handle(input_read)
    close_handle(output_write)
    if options.mode == 'signal':
        until('Server listening')
        if os.environ.get('TIMMY_TEST_CTRL_EVENT') != '1':
            send('\x03')
        if os.environ.get('TIMMY_TEST_CTRL_EVENT') == '1' or wait_process(info.process, 2000) != 0:
            # Some hosted ConPTY environments do not translate the input byte into a control event.
            free_console()
            checked(attach_console(info.pid))
            checked(set_control_handler(None, True))
            checked(generate_control(0, 0))
            checked(free_console())
    elif options.mode == 'logs':
        until('TIMMY_LOG_CREATED café')
        send('\x03')
    else:
        until('/ cmds')
        send('halo dap café')
        until('café')
        send('\x1b\r')
        time.sleep(0.1)
        send('baris kedua')
        until('baris kedua')
        send('\r')
        until('TIMMY_WINDOWS_OK')
        time.sleep(0.2)
        send('TIMMY_HOLD')
        time.sleep(0.1)
        send('\r')
        until('WAITING_FOR_CANCEL')
        send('\x1b')
        time.sleep(0.2)
        if resize(console, Coord(80, 24)) != 0:
            raise RuntimeError('Console resize failed')
        time.sleep(0.2)
        send('/exit')
        time.sleep(0.2)
        send('\r')
    if wait_process(info.process, 15_000) != 0:
        receipt_path = Path(os.environ['TIMMY_HOME']) / 'shutdown.json'
        receipt = receipt_path.read_text() if receipt_path.exists() else 'missing'
        raise AssertionError(f'Console command did not exit; receipt={receipt}: {text()[-2000:]}')
    code = w.DWORD()
    checked(exit_code(info.process, c.byref(code)))
    if code.value != 0:
        raise AssertionError(f'Console command exit {code.value}: {text()[-2000:]}')
    if options.mode == 'signal':
        receipt = json.loads((Path(os.environ['TIMMY_HOME']) / 'shutdown.json').read_text())
        assert receipt == {'pid': info.pid, 'ok': True}, receipt
        print('PASS native Windows console Ctrl+C and graceful cleanup receipt')
    elif options.mode == 'logs':
        print('PASS native Windows console log follow: UTF-8 output and Ctrl+C cleanup')
    else:
        print('PASS native Windows console TUI: Unicode, multiline, provider response, Escape cancellation, resize and /exit')
finally:
    close_console(console)
    close_handle(input_write)
    reader.join(timeout=2)
    close_handle(output_read)
    if info.thread:
        close_handle(info.thread)
    if info.process:
        close_handle(info.process)
    delete_attributes(storage)
