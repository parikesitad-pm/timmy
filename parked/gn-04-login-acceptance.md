# GN-04.06 - actual login acceptance

Status: planned, parked. Dependency: [GN-04](../plan/gn-04-daemon-lifecycle.md) implementation.

- [ ] GN-04.06 - During a user-controlled sign-out/sign-in, verify one scheduled instance, correct profile/working directory and healthy endpoint; then stop and disable the task.

Task registration, Limited/Interactive principal, explicit Scheduler launch, spaces, health, graceful stop and repeated on/off/status already passed. They do not prove a real login trigger. Parked because an automatic logout would disrupt the user's desktop. Resume when dap chooses a login cycle. Next action: enable autostart before that cycle and check health afterward. Update the GN stage and [pilot](../pilot.md).
