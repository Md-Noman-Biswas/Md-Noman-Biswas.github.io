---
layout: home
title: About
permalink: /
---

{{ site.data.profile.bio | markdownify }}

<div class="seeking-callout">
  {{ site.data.profile.seeking | markdownify }}
</div>

## Research Interests

<ul class="research-list">
{% for interest in site.data.interests %}
  <li>{{ interest }}</li>
{% endfor %}
</ul>

## Recent News

<div class="news-section">
{% for item in site.data.news %}
  <div class="news-item">
    <span class="news-date">{{ item.date }}</span>
    <span class="news-text">
      {{ item.text }}
    </span>
  </div>
{% endfor %}
</div>
