---
layout: page
title: Projects
permalink: /projects/
description: "Selected software and research projects"
---

<div class="projects-grid">
{% for project in site.data.projects %}
  {% include project-card.html project=project %}
{% endfor %}
</div>

---

<p class="text-muted mt-3" style="font-size: 0.85rem;">
  <i class="fa-brands fa-github me-1"></i>
  More projects on <a href="https://github.com/{{ site.data.profile.github }}" target="_blank" rel="noopener">GitHub</a>.
</p>
