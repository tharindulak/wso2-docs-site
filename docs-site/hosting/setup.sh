#!/bin/bash
# Sets up (or checks) the docs VM for the Deploy and Preview workflows: Docker and Typesense, the deploy user's
# folders, the gate and the four deploy keys. Safe to run again. The web server is not touched (decided separately).
# Decided in .scratch/wso2-docs-site-delivery/issues/08-hosting-config-caddy-and-typesense.md.
#
#   sudo ./setup.sh apply --keys <dir> [--search-url https://search.example] [--cors-origin https://site.example]
#   sudo ./setup.sh check
#
# --keys: a folder with the public halves of the deploy keys (private halves stay with GitHub secrets):
#   site-upload.pub     rrsync, write-only into /srv/docs/releases            (Deploy: Build job)
#   site-gate.pub       docs-gate site: current, switch, rollback, prune      (Deploy: Plan and Promote jobs)
#   preview-upload.pub  rrsync, write-only into /srv/docs/previews/builds     (Preview: Build job)
#   preview-gate.pub    docs-gate preview: plan, switch, delete, clean        (Preview: Plan and Promote jobs)
# A missing file leaves that key out. Each must be one ssh-ed25519 public key.
set -euo pipefail
export LC_ALL=C
HERE=$(cd -- "$(dirname -- "$0")" && pwd)

BASE=/srv/docs
ETC=/etc/docs-site
GATE=/usr/local/sbin/docs-gate
COMPOSE_DIR=/opt/docs-site/typesense
KEYS_FILE=/etc/ssh/authorized_keys/deploy
SSHD_CONF=/etc/ssh/sshd_config.d/60-docs-deploy.conf
DOCKER_KEY_FPR=9DC858229FC7DD38854AE2D88D81803C0EBFCD88   # Docker's apt signing key (download.docker.com)

die() { echo "setup: $*" >&2; exit 1; }
[[ $(id -u) == 0 ]] || die "run as root (sudo)"

# The authorized_keys lines, one per key: what each key may run.
key_command() {
  case $1 in
    site-upload)    echo "/usr/bin/rrsync -wo -no-del -munge $BASE/releases" ;;
    site-gate)      echo "$GATE site" ;;
    preview-upload) echo "/usr/bin/rrsync -wo -no-del -munge $BASE/previews/builds" ;;
    preview-gate)   echo "$GATE preview" ;;
  esac
}
KEY_NAMES=(site-upload site-gate preview-upload preview-gate)

sshd_conf() {
  cat <<EOF
# docs-site deploy user (hosting/setup.sh): keys in a root-owned file, so nothing the user writes changes them.
Match User deploy
    AuthorizedKeysFile $KEYS_FILE
    DisableForwarding yes
    PermitTTY no
EOF
}

gate_conf() {   # $1 search URL, may be empty
  cat <<EOF
# docs-gate settings (hosting/setup.sh). Root-owned: the gate sources it.
BASE=$BASE
KEEP=3
STALE_MINUTES=1440
TYPESENSE_URL=http://127.0.0.1:8108
TYPESENSE_ENV=$ETC/typesense.env
SEARCH_PUBLIC_URL=$1
PREVIEW_MAX=10
PREVIEW_MIN_FREE_GB=10
PREVIEW_DAYS=14
EOF
}

# Install $2 at $3 with owner $1 and mode $4 when it differs; report what changed.
put() {
  if [[ -f $3 ]] && cmp -s -- "$2" "$3" && [[ $(stat -c '%U:%G %a' -- "$3") == "$1 $4" ]]; then return 0; fi
  install -o "${1%%:*}" -g "${1##*:}" -m "$4" -- "$2" "$3"
  echo "updated $3"
}

install_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then return 0; fi
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg jq >/dev/null
  install -d -m 755 /etc/apt/keyrings
  local key; key=$(mktemp)
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "$key"
  [[ $(gpg --show-keys --with-colons "$key" 2>/dev/null | awk -F: '/^fpr/ { print $10; exit }') == "$DOCKER_KEY_FPR" ]] \
    || die "Docker's apt key does not have the expected fingerprint $DOCKER_KEY_FPR"
  install -m 644 "$key" /etc/apt/keyrings/docker.asc; rm -f "$key"
  # shellcheck source=/dev/null
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
  echo "installed Docker $(docker --version)"
}

apply() {
  local keys='' search_url='' cors=''
  while (( $# )); do
    case $1 in
      --keys) keys=$2; shift 2 ;;
      --search-url) search_url=$2; shift 2 ;;
      --cors-origin) cors=$2; shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  [[ -d $keys ]] || die "--keys must name a folder of public keys"
  for u in "$search_url" "$cors"; do [[ -z $u || $u =~ ^https://[a-z0-9.-]+(:[0-9]+)?$ ]] || die "$u: give an https origin"; done

  apt-get install -y -qq jq rsync >/dev/null
  install_docker

  # The deploy user: no sudo, no password; /bin/sh, so a forced command never runs bash login files (rrsync man page).
  id deploy >/dev/null 2>&1 || useradd --create-home --user-group deploy
  usermod -s /bin/sh deploy
  passwd -l deploy >/dev/null
  id -nG deploy | grep -qw sudo && die "deploy must not be in the sudo group"
  install -d -o deploy -g deploy -m 755 "$BASE" "$BASE/releases" "$BASE/previews" "$BASE/previews/builds" "$BASE/previews/live"

  # Gate and its settings.
  install -d -o root -g root -m 755 "$ETC"
  put root:root "$HERE/docs-gate" "$GATE" 755
  local tmp; tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' RETURN
  gate_conf "$search_url" >"$tmp/gate.conf"
  put root:root "$tmp/gate.conf" "$ETC/gate.conf" 644

  # Typesense keys: made once on the VM, never printed. The gate (as deploy) reads them; nobody else can.
  if [[ ! -f $ETC/typesense.env ]]; then
    printf 'TYPESENSE_ADMIN_KEY=%s\nTYPESENSE_SEARCH_KEY=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" >"$tmp/ts.env"
    install -o root -g deploy -m 640 "$tmp/ts.env" "$ETC/typesense.env"
    echo "created $ETC/typesense.env (new admin and search keys)"
  fi
  grep -v '^DOCS_CORS_' "$ETC/typesense.env" >"$tmp/ts.env"
  [[ -n $cors ]] && printf 'DOCS_CORS_ENABLED=true\nDOCS_CORS_ORIGIN=%s\n' "$cors" >>"$tmp/ts.env"
  put root:deploy "$tmp/ts.env" "$ETC/typesense.env" 640

  install -d -m 755 "$COMPOSE_DIR"
  put root:root "$HERE/typesense/compose.yaml" "$COMPOSE_DIR/compose.yaml" 644
  docker compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ETC/typesense.env" up -d --quiet-pull
  for _ in $(seq 60); do curl -fsS http://127.0.0.1:8108/health 2>/dev/null | grep -q '"ok":true' && break; sleep 2; done
  curl -fsS http://127.0.0.1:8108/health | grep -q '"ok":true' || die "Typesense did not become healthy"

  # Keys and sshd: write, validate, then reload.
  : >"$tmp/keys"
  for name in "${KEY_NAMES[@]}"; do
    [[ -f $keys/$name.pub ]] || { echo "note: no $name.pub, that key is left out"; continue; }
    local line; line=$(grep -v '^\s*$' "$keys/$name.pub")
    [[ $(wc -l <<<"$line") == 1 && $line =~ ^ssh-ed25519\ [A-Za-z0-9+/]+=*(\ [^\"]*)?$ ]] || die "$name.pub is not one ssh-ed25519 public key"
    printf 'restrict,command="%s" %s\n' "$(key_command "$name")" "$line" >>"$tmp/keys"
  done
  install -d -o root -g root -m 755 /etc/ssh/authorized_keys
  put root:root "$tmp/keys" "$KEYS_FILE" 644
  sshd_conf >"$tmp/sshd"
  put root:root "$tmp/sshd" "$SSHD_CONF" 644
  sshd -t || die "sshd rejects the configuration; nothing was reloaded"
  systemctl reload ssh 2>/dev/null || true
  rm -f /home/deploy/.ssh/authorized_keys   # superseded by $KEYS_FILE
  echo "applied"
}

check() {
  local drift=0 tmp; tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' RETURN
  ok() { echo "ok     $*"; }
  bad() { echo "DRIFT  $*"; drift=1; }
  cmp -s "$HERE/docs-gate" "$GATE" && ok "$GATE" || bad "$GATE differs from the repo"
  cmp -s "$HERE/typesense/compose.yaml" "$COMPOSE_DIR/compose.yaml" && ok "compose file" || bad "compose file differs from the repo"
  sshd_conf >"$tmp/sshd"; cmp -s "$tmp/sshd" "$SSHD_CONF" && ok "$SSHD_CONF" || bad "$SSHD_CONF differs"
  [[ $(sshd -T -C user=deploy,host=x,addr=127.0.0.1 2>/dev/null | awk '/^authorizedkeysfile/ { print $2 }') == "$KEYS_FILE" ]] \
    && ok "sshd uses $KEYS_FILE for deploy" || bad "sshd does not use $KEYS_FILE for deploy"
  [[ $(sshd -T 2>/dev/null | awk '/^permitrootlogin/ { print $2 }') == no ]] && ok "root login off" || bad "root login is not off"
  local name cmd
  for name in "${KEY_NAMES[@]}"; do
    cmd=$(key_command "$name")
    grep -qF "restrict,command=\"$cmd\" " "$KEYS_FILE" 2>/dev/null && ok "key $name" || echo "absent $name key"
  done
  grep -v '^restrict,command="\(/usr/bin/rrsync -wo -no-del -munge \|/usr/local/sbin/docs-gate \)' "$KEYS_FILE" 2>/dev/null | grep -q . \
    && bad "$KEYS_FILE has lines without a known forced command" || ok "no unrestricted deploy keys"
  [[ $(getent passwd deploy | cut -d: -f7) == /bin/sh ]] && ok "deploy shell /bin/sh" || bad "deploy shell is not /bin/sh"
  id -nG deploy | grep -qw sudo && bad "deploy is in the sudo group" || ok "deploy has no sudo"
  for d in "$BASE" "$BASE/releases" "$BASE/previews/builds" "$BASE/previews/live"; do
    [[ $(stat -c '%U %a' "$d" 2>/dev/null) == "deploy 755" ]] && ok "$d" || bad "$d missing or not deploy 755"
  done
  [[ $(stat -c '%U:%G %a' "$ETC/typesense.env" 2>/dev/null) == "root:deploy 640" ]] && ok "typesense.env root:deploy 640" || bad "typesense.env permissions"
  curl -fsS http://127.0.0.1:8108/health 2>/dev/null | grep -q '"ok":true' && ok "Typesense healthy" || bad "Typesense not healthy"
  ss -Htln 'sport = :8108' | awk '{ print $4 }' | grep -qv '^127\.0\.0\.1:' && bad "Typesense listens beyond loopback" || ok "Typesense on loopback only"
  return $drift
}

case ${1:-} in
  apply) shift; apply "$@" ;;
  check) check ;;
  *) die "usage: setup.sh apply --keys <dir> [--search-url URL] [--cors-origin URL] | setup.sh check" ;;
esac
