#!/bin/sh

set -e

cd "$(dirname "$0")"

if [ ! -f docker-compose.yml ]; then
    echo "ERROR: docker-compose.yml not found in $(pwd)" >&2
    exit 1
fi

normalize_override() {
    arg="${1#./}"
    case "$arg" in
        docker-compose.yml)
            echo "ERROR: docker-compose.yml is the base file, always included" >&2
            return 1
            ;;
        docker-compose.*.yml)
            echo "$arg"
            ;;
        *)
            echo "docker-compose.${arg}.yml"
            ;;
    esac
}

read_compose_file() {
    [ -f .env ] || return 0
    grep '^COMPOSE_FILE=' .env | head -n1 | cut -d= -f2- | tr -d "\r\"'"
}

print_config() {
    val="$1"
    [ -z "$val" ] && val="docker-compose.yml"
    echo "COMPOSE_FILE=$val"
    echo "compose files:"
    OLD_IFS=$IFS
    IFS=:
    for f in $val; do
        echo "  $f"
    done
    IFS=$OLD_IFS
    echo ""
}

write_compose_file() {
    new_value="$1"
    if [ ! -f .env ]; then
        echo "ERROR: .env not found in $(pwd)" >&2
        exit 1
    fi
    new_line="COMPOSE_FILE=$new_value"
    if grep -q '^COMPOSE_FILE=' .env; then
        sed -i.old -e "s|^COMPOSE_FILE=.*$|$new_line|" .env
        rm -f .env.old
    else
        cat >> .env <<EOF
COMPOSE_FILE=$new_value
EOF
    fi
}

services_except() {
    all_services=$(docker compose config --services)
    filtered="$all_services"
    for ex in "$@"; do
        echo "$all_services" | grep -qFx "$ex" \
            || echo "Warning: '$ex' is not a service in this project" >&2
        filtered=$(echo "$filtered" | grep -vFx "$ex" || true)
    done
    if [ -z "$filtered" ]; then
        echo "No services left after applying --except" >&2
        return 1
    fi
    printf '%s\n' "$filtered"
}

CMD="${1:-help}"
[ "$#" -gt 0 ] && shift

case "$CMD" in
    start|up)
        exec docker compose up -d --wait "$@"
        ;;
    stop|down)
        exec docker compose down "$@"
        ;;
    restart)
        if [ "${1:-}" = "--except" ]; then
            shift
            [ $# -eq 0 ] && { echo "Usage: $(basename "$0") restart --except <svc>..." >&2; exit 1; }
            services=$(services_except "$@") || exit 1
            exec docker compose restart $services
        fi
        exec docker compose restart "$@"
        ;;
    recreate)
        if [ "${1:-}" = "--except" ]; then
            shift
            [ $# -eq 0 ] && { echo "Usage: $(basename "$0") recreate --except <svc>..." >&2; exit 1; }
            services=$(services_except "$@") || exit 1
            exec docker compose up -d --wait --force-recreate --no-deps $services
        fi
        if [ $# -eq 0 ]; then
            docker compose down
            exec docker compose up -d --wait
        fi
        exec docker compose up -d --wait --force-recreate --no-deps "$@"
        ;;
    status|ps)
        exec docker compose ps "$@"
        ;;
    logs)
        exec docker compose logs -f "$@"
        ;;
    inspect)
        [ $# -eq 0 ] && { echo "Usage: $(basename "$0") inspect <service> [docker-inspect-args]" >&2; exit 1; }
        svc="$1"; shift
        cid=$(docker compose ps -q "$svc")
        [ -z "$cid" ] && { echo "Service '$svc' is not running" >&2; exit 1; }
        exec docker inspect "$cid" "$@"
        ;;
    printenv)
        [ $# -eq 0 ] && { echo "Usage: $(basename "$0") printenv <service>" >&2; exit 1; }
        svc="$1"
        cid=$(docker compose ps -q "$svc")
        [ -z "$cid" ] && { echo "Service '$svc' is not running" >&2; exit 1; }
        exec docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' "$cid"
        ;;
    pull)
        exec docker compose pull "$@"
        ;;
    compose-config)
        exec docker compose config "$@"
        ;;
    config)
        sub="${1:-show}"
        [ "$#" -gt 0 ] && shift
        current=$(read_compose_file)
        case "$sub" in
            show)
                print_config "$current"
                ;;
            add)
                [ $# -eq 0 ] && { echo "Usage: $(basename "$0") config add <name>..." >&2; exit 1; }
                new_value="${current:-docker-compose.yml}"
                changed=false
                for arg in "$@"; do
                    file=$(normalize_override "$arg") || exit 1
                    if [ ! -f "$file" ]; then
                        echo "ERROR: $file not found" >&2
                        exit 1
                    fi
                    case ":$new_value:" in
                        *":$file:"*) echo "Already present: $file" ;;
                        *) new_value="$new_value:$file"; changed=true ;;
                    esac
                done
                [ "$changed" = true ] && write_compose_file "$new_value"
                print_config "$new_value"
                ;;
            remove|rm)
                [ $# -eq 0 ] && { echo "Usage: $(basename "$0") config remove <name>..." >&2; exit 1; }
                new_value="${current:-docker-compose.yml}"
                changed=false
                for arg in "$@"; do
                    file=$(normalize_override "$arg") || exit 1
                    case ":$new_value:" in
                        *":$file:"*)
                            tmp=""
                            OLD_IFS=$IFS
                            IFS=:
                            for tok in $new_value; do
                                [ "$tok" = "$file" ] || tmp="${tmp:+$tmp:}$tok"
                            done
                            IFS=$OLD_IFS
                            new_value="$tmp"
                            changed=true
                            ;;
                        *)  echo "Not present: $file" ;;
                    esac
                done
                [ "$changed" = true ] && write_compose_file "$new_value"
                print_config "$new_value"
                ;;
            *)
                echo "Unknown config subcommand: $sub" >&2
                exit 1
                ;;
        esac
        ;;
    secrets)
        if [ ! -f .env ]; then
            echo "ERROR: .env not found in $(pwd)" >&2
            exit 1
        fi
        for var in POSTGRES_PASSWORD DASHBOARD_PASSWORD \
                   SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY \
                   S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET; do
            line=$(grep "^${var}=" .env | head -n1)
            if [ -n "$line" ]; then
                echo "$line"
            else
                echo "${var}="
            fi
        done
        echo ""
        ;;
    help|-h|--help)
        cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  start                 Start the stack (docker compose up -d --wait)
  stop                  Stop the stack (docker compose down)
  restart [service]     Restart the stack (or named services)
  recreate [service]    Stop then start, or force-recreate one service
  status                Show service status
  logs [service]        Follow logs (optionally for a single service)
  inspect <service>     Inspect a service's container
  printenv <service>    Print a service's environment variables
  pull                  Pull all images
  config                Show the active COMPOSE_FILE list
  config add <name>     Add an override to COMPOSE_FILE
  config remove <name>  Remove an override from COMPOSE_FILE
  compose-config        Dump the fully-resolved docker compose config
  secrets               Show key passwords and API keys from .env
EOF
        ;;
    *)
        echo "Unknown command: $CMD" >&2
        echo "Run '$0 help' for usage." >&2
        exit 1
        ;;
esac
