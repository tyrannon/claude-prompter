#!/bin/bash
# Claude Prompter wrapper script for cross-project usage

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Export the API key from the .env file
export $(grep OPENAI_API_KEY "$SCRIPT_DIR/.env" | xargs)

# Run claude-prompter with all arguments passed to this script
node "$SCRIPT_DIR/dist/cli.js" "$@"