# News Bridge — Speaker Script (~12 minutes)

**Total target time:** ~12 minutes (≈33 seconds per slide on average)  
**Pace:** Conversational — not rushed, not over-explained.  
**Tip:** Transition lines at the end of each slide bridge naturally into the next.

---

## Slide 1 — Title (~25 sec)

Good [morning/afternoon]. My name is [your name], and today I'll present **News Bridge** — our graduation project from the Faculty of Engineering and Information Technology at An-Najah National University.

News Bridge is an AI-driven platform that collects news from multiple sources, enriches it with machine learning, and delivers a personalized feed to users — in both Arabic and English.

---

## Slide 2 — Agenda (~30 sec)

Here's how the presentation is organized.

We'll start with the problem and the technology behind the system, then look at the three ways news enters the platform. After that, we'll walk through the main website pipeline step by step — that's the core of the project. We'll briefly cover Telegram and editor workflows, then the extra features, results, and limitations.

*→ This gives you a map of everything we'll cover before diving in.*

---

## Slide 3 — Project Overview (~40 sec)

So what is News Bridge in practice?

It's a full news platform — not just a scraper or a feed app. A **Java Spring Boot** backend holds all the data and security. **Python services** handle crawling, NLP, and AI. Users interact through a **web app**, an **admin dashboard**, and a **mobile app**.

News comes from three places: crawled websites, Telegram channels, and posts written by approved editors. Everything supports **Arabic and English** end to end.

The system is substantial — dozens of API controllers, over fifty database entities, five ML components, and seven news categories.

*→ That sets the scope. The natural question is: why build something this complex?*

---

## Slide 4 — The Challenge (~40 sec)

Existing news apps leave several gaps.

Websites all look different, so simple scrapers break easily. It's hard to know which URLs are article listings versus single articles. Arabic and English need different NLP treatment. Users rarely set detailed preferences, so the system has to learn from behavior. Keyword search can't answer questions like "what's happening in Gaza?" And in many regions, **Telegram** is as important as traditional news sites.

News Bridge tries to address all of these in one integrated pipeline — not as separate tools.

*→ To do that, we needed a specific technical setup — which brings us to the stack.*

---

## Slide 5 — Technical Background (~45 sec)

The architecture follows a **hub-and-spoke** pattern.

React web apps, a mobile app, and a 3D avatar sit on the client side. Everything talks to **Spring Boot** on port 8080 — that's the central API and database layer. Around it, **Python microservices** do the heavy work: site crawling on 8000, endpoint discovery on 8004, Telegram on 8200, and the AI assistant on 9000.

For machine learning we use PyTorch and HuggingFace — page classification, content extraction, categorization, tagging, and vector search with FAISS and Ollama.

*→ With that foundation in place, let's see where the news actually comes from.*

---

## Slide 6 — Three News Sources (~35 sec)

There are three distinct content tracks.

**First**, web articles — crawled from registered news domains, run through the full ML pipeline, and shown in the main category feed.

**Second**, Telegram — channel messages pulled via Telethon, with a web fallback, in a separate personalized Telegram feed.

**Third**, editor content — live updates on news events and curated topic posts, with an admin approval workflow.

All three converge on the same backend and database, then reach users through web, mobile, and admin tools.

*→ The richest pipeline is the website track — let's look at that overview before going step by step.*

---

## Slide 7 — Website Pipeline Overview (~35 sec)

The website pipeline has six stages.

An admin **registers a root** — a news domain. The system **discovers listing endpoints**, then **crawls** them for new articles. Posts are **classified and tagged**, ranked into a **personalized feed**, and user **feedback** updates future recommendations.

Enrichment runs every ten seconds; the page classifier reaches about **89% macro-F1** accuracy. The whole flow turns a newly registered site into feed-ready posts in minutes, not manual copy-paste.

*→ It starts with the admin registering a source — step one.*

---

## Slide 8 — Accepting Roots (~28 sec)

Step one is **accepting roots**.

An admin adds a news domain — name and base URL — through the admin dashboard. That creates a **Root** record in the database. Optionally, we run trust checks using sources like Wayback, Wikidata, and MBFC.

Every article we crawl later traces back to one of these approved domains. Nothing enters the system without admin consent.

*→ Once a root exists, we need to find the right pages to crawl — that's endpoint discovery.*

---

## Slide 9 — Discovering Endpoints (~28 sec)

Step two: **discovering endpoints**.

The admin triggers discovery. A Python service BFS-crawls the domain and uses an **XLM-RoBERTa** classifier to find **listing pages** — the index pages that link to many articles, not individual stories.

The admin reviews the results and imports the chosen URLs. Our classifier was trained on about **2,400 labeled pages** from **201 domains**, with roughly **89% macro-F1** — good enough to scale discovery without hand-picking every URL.

*→ With endpoints in place, the crawler can run continuously.*

---

## Slide 10 — Crawling Articles (~32 sec)

Step three is **crawling**.

The site crawler picks endpoints by priority — never-crawled sites go first. It fetches listing pages, extracts links, and skips URLs it's already seen. Each candidate is classified: is it an article? If yes, a deep-learning extractor pulls out title, text, and images.

New articles are sent to the backend as **Article** and **Post** records. For difficult sites we fall back from lightweight HTTP fetching to **Playwright** when JavaScript rendering is required.

*→ Raw posts still need labels and tags before they appear meaningfully in the feed.*

---

## Slide 11 — Post-Processing (~28 sec)

Step four: **post-processing**.

Every ten seconds, a background job classifies unlabeled posts into one of **seven categories** and detects language. Then a tagging step runs **NER** — BERT for English, CAMeL-BERT for Arabic — plus **YAKE** keyword extraction.

Arabic text is normalized first. Once enriched, posts become eligible for personalized ranking and for the AI vector index.

*→ Enriched posts then need to reach the right user — that's delivery and feedback.*

---

## Slide 12 — Preferences, Delivery & Feedback (~32 sec)

Step five ties it together: **preferences, delivery, and feedback**.

The feed API scores posts using tag affinity at **45%**, category at **25%**, recency at **20%**, and popularity at **10%**. User preferences are stored as tag weights that update from views, clicks, time on post, and likes or dislikes.

The model is **tag-centric** on purpose — it's easier to explain why a story appeared than with a black-box recommender.

*→ That's the full website path. Two other sources feed the platform in parallel.*

---

## Slide 13 — Telegram Pipeline (~30 sec)

The **Telegram pipeline** follows a similar spirit but simpler ingestion.

Channels are registered in the admin panel. A dedicated crawler on port 8200 pulls messages via **Telethon**, with a web-scraper fallback when the API is restricted. Posts bulk-import into the backend.

Users get a separate Telegram feed — For You, By Channel, and Discover — because Telegram content is structurally different from full web articles.

*→ The third source adds a human editorial layer.*

---

## Slide 14 — Editor Posting Pipeline (~28 sec)

**Editor posting** is workflow-driven.

A user applies to become an editor; an admin approves them. Admins create **news events**, which can link to trending topics. Editors request permission, then publish **live news updates** or **topic posts** after approval.

This gives the platform curated, event-driven coverage alongside automated crawling.

*→ Beyond these three pipelines, the platform includes several supporting features.*

---

## Slide 15 — Additional Features (~32 sec)

News Bridge also includes an **admin dashboard** for sources, crawlers, and users; a **mobile app** built with Expo; **comments and reactions**; **saved posts**; **source verification** against external trust databases; **location-aware ranking**; full **Arabic and English** support with RTL; and a **service manager** desktop app to orchestrate all microservices during development.

These aren't the headline pipelines, but they're what makes the system usable day to day.

*→ Two features deserve a closer look: the AI assistant and the news brief with the 3D presenter.*

---

## Slide 16 — RAG AI Assistant (~38 sec)

The **AI assistant** on port 9000 is a RAG system — retrieval-augmented generation.

Posts are chunked, embedded, and stored in a **FAISS** index. When a user asks a question, we retrieve the most relevant chunks and pass them to a local **Ollama** LLM. The answer includes references to source posts.

It also supports **translation** between Arabic and English and on-demand vector ingestion. A scheduler refreshes the index every fifteen minutes. Everything runs locally — no mandatory cloud API — which matters given our hardware constraints.

*→ One output of that AI layer is the personalized news brief — which the avatar can then narrate.*

---

## Slide 17 — News Brief & 3D Presenter (~38 sec)

The **news brief** calls the same AI service to score recent posts against user preferences and generate a short personalized summary. It appears in the main feed; if the LLM is unavailable, we fall back to a simple headline list.

The **3D presenter** takes that same brief. In the avatar studio, each story is read aloud with **text-to-speech**, lip-synced via **Rhubarb**, and rendered in **Three.js** — with the title and summary shown on a screen inside the scene.

It's a step toward accessible, audiovisual news — not just scrolling text.

*→ With the system built, we evaluated how well the key components perform.*

---

## Slide 18 — Evaluation Results (~35 sec)

On **evaluation**, the page classifier reached about **89% macro-F1**. The category classifier shows high confidence on held-out data. Tag extraction performs well on named entities. Integration tests passed end to end — from registering a root, through discovery and crawl, to a labeled post appearing in the feed with working RAG Q&A.

So the pipeline doesn't just work in isolation — the pieces connect in practice.

*→ That said, building it taught us as much about limits as about successes.*

---

## Slide 19 — Discussion (~32 sec)

A few takeaways from the discussion.

The **microservice split** — Java for data and security, Python for ML — kept concerns separated and made iteration easier. **ML-guided endpoint discovery** scaled across hundreds of domains without manual URL hunting. **Tag-based personalization** gives interpretable ranking. A **local AI stack** is viable if you manage freshness carefully. And combining **Telegram plus editors** with automated crawling covers sources a crawler alone would miss.

*→ Honest evaluation also means acknowledging what held us back.*

---

## Slide 20 — Constraints & Limitations (~38 sec)

We worked under real **resource limits**.

Development machines had **limited GPU memory**, so we couldn't train large models or run many ML services at once. **No cloud GPU budget** meant relying on **small quantized Ollama models** — good enough for a demo, but weaker than cloud LLMs for summaries and Q&A. **CPU inference** made enrichment and RAG noticeably slow. Labeling was **manual and capped** at around 2,400 pages. Avatar and TTS quality suffered without a dedicated GPU server.

We're a **small team**, sources are **admin-registered only**, Telegram has **API restrictions**, and Playwright is **RAM-heavy** on low-spec hardware. There's no production scaling or 24/7 ops budget.

*→ Despite those limits, the project still demonstrates a coherent end-to-end system.*

---

## Slide 21 — Conclusions & Future Work (~35 sec)

In conclusion, News Bridge shows that a **modular pipeline** can take news from registration to personalized delivery with modern NLP throughout. The **page classifier** makes endpoint discovery practical at scale. **Tag-centric feeds** keep recommendations explainable. **Local RAG** works without cloud lock-in. And the **brief plus avatar** connects AI summarization to how people actually consume news.

Future work — if resources allow — includes full **geo-ranking** in the backend, a **production TTS service**, bridging **Telegram into the main feed**, and **mobile avatar** support.

*→ That wraps up the presentation.*

---

## Slide 22 — Thank You (~15 sec)

Thank you for your time. I'm happy to take your questions.

---

## Timing summary


| Slides    | Section                          | ~Time      |
| --------- | -------------------------------- | ---------- |
| 1–2       | Opening & agenda                 | 0:55       |
| 3–4       | Overview & challenge             | 1:20       |
| 5–6       | Tech & sources                   | 1:20       |
| 7–12      | Website pipeline                 | 3:08       |
| 13–14     | Telegram & editor                | 0:58       |
| 15–17     | Features & AI                    | 1:48       |
| 18–20     | Results, discussion, constraints | 1:45       |
| 21–22     | Conclusion & close               | 0:50       |
| **Total** |                                  | **~12:00** |
