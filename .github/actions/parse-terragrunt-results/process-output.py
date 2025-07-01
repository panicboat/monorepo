#!/usr/bin/env python3
import urllib.parse
import sys

def process_terragrunt_output(action_type):
    """Process and decode Terragrunt output"""
    try:
        with open('/tmp/raw_output.txt', 'r') as f:
            encoded_content = f.read().strip()

        if not encoded_content:
            return f"{action_type} execution completed. See workflow logs for detailed output."

        # URL decode the content
        decoded_content = urllib.parse.unquote(encoded_content)

        # Truncate if too long
        max_length = 30000
        if len(decoded_content) > max_length:
            decoded_content = decoded_content[:max_length] + "... (output truncated, see workflow logs for full details)"

        return decoded_content

    except Exception as e:
        return f"Error processing output: {str(e)}. See workflow logs for detailed output."

if __name__ == "__main__":
    action_type = sys.argv[1] if len(sys.argv) > 1 else "execution"
    result = process_terragrunt_output(action_type)
    print(result)
