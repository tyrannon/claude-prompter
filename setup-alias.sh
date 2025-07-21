#!/bin/bash
# Setup script for claude-prompter alias

SCRIPT_PATH="/Users/kaiyakramer/claude-prompter-standalone/use-from-anywhere.sh"
ALIAS_NAME="claude-prompter"

echo "Setting up claude-prompter alias..."

# Detect shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    echo "Unsupported shell. Please manually add: alias $ALIAS_NAME='$SCRIPT_PATH'"
    exit 1
fi

# Check if alias already exists
if grep -q "alias $ALIAS_NAME=" "$SHELL_RC" 2>/dev/null; then
    echo "Alias already exists in $SHELL_RC"
else
    echo "" >> "$SHELL_RC"
    echo "# Claude Prompter alias for cross-project usage" >> "$SHELL_RC"
    echo "alias $ALIAS_NAME='$SCRIPT_PATH'" >> "$SHELL_RC"
    echo "Alias added to $SHELL_RC"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To use claude-prompter from anywhere:"
echo "1. Run: source $SHELL_RC"
echo "2. Then use: $ALIAS_NAME [command] [options]"
echo ""
echo "Example: $ALIAS_NAME suggest -t 'React frontend architecture' --complexity complex"