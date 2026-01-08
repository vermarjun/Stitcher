"""Should fail: tries to read /etc/shadow and write outside /work."""
open("/etc/shadow", "rb").read()
with open("/home/hacked", "w") as f:
    f.write("pwned")
print("ESCAPE: fs read/write succeeded")
