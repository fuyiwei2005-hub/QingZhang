"""Run interactively as root on the deployment server. Never accepts a key as an argument."""
import getpass, os, pwd, tempfile
from pathlib import Path
if os.name != "posix" or os.geteuid() != 0:
 raise SystemExit("Run this script interactively as root on the deployment server")
secret=getpass.getpass("DeepSeek API key (hidden input): ").strip()
if not secret or any(c.isspace() for c in secret) or any(c in secret for c in '\"\\'):
 raise SystemExit("Invalid key; configuration was not changed")
path=Path("/etc/hengxu/ai.env")
path.parent.mkdir(mode=0o750,parents=True,exist_ok=True)
account=pwd.getpwnam("hengxu")
content='AI_ENABLED=true\nAI_BASE_URL=https://api.deepseek.com\nAI_MODEL=deepseek-v4-pro\nAI_VISION_MODEL=deepseek-flash\nAI_API_KEY="'+secret+'"\nAI_USER_DAILY_LIMIT=20\nAI_GLOBAL_DAILY_LIMIT=200\n'
fd,name=tempfile.mkstemp(dir=path.parent,prefix="ai-")
try:
 with os.fdopen(fd,"w") as output:output.write(content)
 os.chmod(name,0o600);os.chown(name,account.pw_uid,account.pw_gid);os.replace(name,path)
 os.chown(path.parent,0,account.pw_gid);os.chmod(path.parent,0o750)
finally:
 if os.path.exists(name):os.unlink(name)
print("AI configuration saved. Restart hengxu.service to activate. The key was not printed.")
