---
layout: page
title: Blog
permalink: /blog/
description: "Notes on AI research, machine learning, and competitive programming"
---

<div class="blog-list">
  {% for post in site.posts %}
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

  {% if site.posts.size == 0 %}
  <p class="text-muted">No posts yet — check back soon!</p>
  {% endif %}
</div>
