import os

def collect_code(root_dir, output_file):
    extensions = {'.py'}

    with open(output_file, 'w', encoding='utf-8') as out:
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                ext = os.path.splitext(filename)[1]
                if ext in extensions:
                    full_path = os.path.join(dirpath, filename)

                    # Create relative path from root_dir
                    rel_path = os.path.relpath(full_path, root_dir)

                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                    except Exception as e:
                        print(f"Skipping {full_path}: {e}")
                        continue

                    # Write formatted output
                    out.write(f"// {root_dir}/{rel_path}\n")
                    out.write(content)
                    out.write("\n\n\n")  # spacing between files

if __name__ == "__main__":
    root_directory = "../backend/ai-assistant-service"
    output_file = "output.txt"

    collect_code(root_directory, output_file)
    print(f"Done! Output written to {output_file}")
