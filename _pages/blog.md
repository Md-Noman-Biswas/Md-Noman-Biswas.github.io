---
layout: page
title: Blog
permalink: /blog/
description: "Notes on AI research, machine learning, and competitive programming"
---

<div class="blog-list">
  {% for post in paginator.posts %}
  <article class="blog-preview">
    <h3>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </h3>
    <div class="post-meta">
      <i class="fa-regular fa-calendar"></i>
      {{ post.date | date: "%B %d, %Y" }}
      {% if post.categories and post.categories.size > 0 %}
        &middot;
        {% for cat in post.categories %}
          <span class="tag">{{ cat }}</span>
        {% endfor %}
      {% endif %}
    </div>
    <p class="post-excerpt">
      {{ post.excerpt | strip_html | truncatewords: 45 }}
    </p>
    <a href="{{ post.url | relative_url }}" class="read-more">
      Read more <i class="fa-solid fa-arrow-right ms-1" style="font-size: 0.75em;"></i>
    </a>
  </article>
  {% endfor %}

  {% if paginator.total_posts == 0 %}
  <p class="text-muted">No posts yet — check back soon!</p>
  {% endif %}
</div>

{% if paginator.total_pages > 1 %}
<nav class="blog-pagination" aria-label="Blog pages">
  <ul class="pagination">
    {% if paginator.previous_page %}
    <li class="page-item">
      <a class="page-link" href="{{ paginator.previous_page_path | relative_url }}">
        <i class="fa-solid fa-chevron-left me-1"></i>Newer
      </a>
    </li>
    {% endif %}

    <li class="page-item disabled">
      <span class="page-link">
        Page {{ paginator.page }} of {{ paginator.total_pages }}
      </span>
    </li>

    {% if paginator.next_page %}
    <li class="page-item">
      <a class="page-link" href="{{ paginator.next_page_path | relative_url }}">
        Older<i class="fa-solid fa-chevron-right ms-1"></i>
      </a>
    </li>
    {% endif %}
  </ul>
</nav>
{% endif %}
