---
layout: page
title: Publications
permalink: /publications/
description: "Research papers and manuscripts by Md. Noman Biswas Sibly"
---

<div class="publications-page">

{% assign accepted_pubs = site.data.publications | where: "status", "accepted" %}
{% assign review_pubs   = site.data.publications | where: "status", "under_review" %}
{% assign ongoing_pubs  = site.data.publications | where: "status", "ongoing" %}

{% if accepted_pubs.size > 0 %}
## Accepted / Published

{% for pub in accepted_pubs %}
  {% include publication-card.html pub=pub %}
{% endfor %}
{% endif %}

{% if review_pubs.size > 0 %}
## Under Review

{% for pub in review_pubs %}
  {% include publication-card.html pub=pub %}
{% endfor %}
{% endif %}

{% if ongoing_pubs.size > 0 %}
## Ongoing Research

{% for pub in ongoing_pubs %}
  {% include publication-card.html pub=pub %}
{% endfor %}
{% endif %}

</div>

---

<p class="text-muted" style="font-size: 0.85rem;">
  <i class="fa-solid fa-circle-info me-1"></i>
  Authors with <strong>bold</strong> name indicate Md. Noman Biswas Sibly as the author.
  DOI, PDF, and arXiv links will be added upon publication.
</p>
