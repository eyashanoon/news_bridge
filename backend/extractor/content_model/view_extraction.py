import json
from pathlib import Path


def create_html_from_extraction(json_file, output_html):
    """Convert extracted JSON to article-like HTML visualization"""

    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = data.get("title", "No Title")
    url = data.get("url", "")
    content = data.get("content", [])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">      
    <title>{title}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: Georgia, 'Times New Roman', serif;
            line-height: 1.8;
            color: #1a1a1a;
            background: #f5f5f5;
            padding: 20px;
        }}

        article {{
            max-width: 700px;
            margin: 0 auto;
            background: white;
            padding: 60px 50px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}

        h1 {{
            font-size: 2.8em;
            line-height: 1.2;
            margin-bottom: 20px;
            color: #000;
            font-weight: 700;
        }}

        .article-meta {{
            color: #666;
            font-size: 0.95em;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #ddd;
        }}

        .article-meta a {{
            color: #0066cc;
            text-decoration: none;
        }}

        .article-meta a:hover {{
            text-decoration: underline;
        }}

        .article-body {{
            font-size: 1.1em;
            line-height: 1.85;
        }}

        p {{
            margin-bottom: 20px;
            text-align: justify;
        }}

        img {{
            max-width: 100%;
            height: auto;
            display: block;
            margin: 30px 0;
            border-radius: 4px;
        }}

        figure {{
            margin: 30px 0;
        }}

        figcaption {{
            font-size: 0.9em;
            color: #666;
            margin-top: 10px;
            font-style: italic;
        }}
    </style>
</head>
<body>
    <article>
        <h1>{title}</h1>
        <div class="article-meta">
            <a href="{url}" target="_blank">View Original Article</a>
        </div>
        <div class="article-body">
"""

    for item in content:
        item_type = item.get("type", "text")

        if item_type == "text":
            text = item.get("text", "").replace("<", "&lt;").replace(">", "&gt;")
            html += f"            <p>{text}</p>\n"

        elif item_type == "image":
            src = item.get("src", "")
            alt = item.get("alt", "")
            if src:
                html += f"            <figure>\n"
                html += f"                <img src=\"{src}\" alt=\"{'Article image' if not alt else alt}\">\n"
                html += f"                <figcaption>{'Article image' if not alt else alt}</figcaption>\n"
                html += f"            </figure>\n"

        elif item_type == "video":
            src = item.get("src", "")
            if src:
                html += f"            <p><strong>[Video content]</strong> <a href=\"{src}\" target=\"_blank\">View video</a></p>\n"

    html += """        </div>
    </article>
</body>
</html>
"""

    with open(output_html, "w", encoding="utf-8") as f:
        f.write(html)
