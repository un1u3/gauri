#!/bin/sh
# Makes "gemma4-e2b-text": gemma4:e2b without its image/audio part, which Gauri never uses.
# Same weights, no download, no extra disk space, about 1 GB less memory when running.
# Gauri uses this copy automatically when it exists. Undo with: ollama rm gemma4-e2b-text
set -e
ollama show gemma4:e2b --modelfile | awk '/^FROM /{ n++; if (n > 1) next } { print }' > /tmp/gauri-Modelfile.text
ollama create gemma4-e2b-text -f /tmp/gauri-Modelfile.text
rm -f /tmp/gauri-Modelfile.text
ollama list | grep gemma4
