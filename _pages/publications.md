---
layout: page
title: Publications
permalink: /publications/
description: "Research papers and manuscripts by Md. Noman Biswas Sibly"
---

<!-- Headings below are raw <h2> on purpose: kramdown does not parse Markdown
     inside a block-level HTML element, so "## …" would render literally here. -->
<div class="publications-page">

{% assign accepted_pubs = site.data.publications | where_exp: "p", "p.status == 'published' or p.status == 'accepted'" %}
{% assign review_pubs   = site.data.publications | where: "status", "under_review" %}
{% assign prep_pubs     = site.data.publications | where: "status", "in_preparation" %}
{% assign ongoing_pubs  = site.data.publications | where: "status", "ongoing" %}

{% if accepted_pubs.size > 0 %}
<h2>Accepted / Published</h2>

{% for pub in accepted_pubs %}
  {% include publication-card.html pub=pub %}
{% endfor %}
{% endif %}

{% if review_pubs.size > 0 %}
<h2>Under Review</h2>

{% for pub in review_pubs %}
  {% include publication-card.html pub=pub %}
{% endfor %}
{% endif %}

{% if prep_pubs.size > 0 %}
<h2>Manuscripts in Preparation</h2>

{% for pub in prep_pubs %}
  {% include publication-card.html pub=pub %}
{% endfor %}
{% endif %}

{% if ongoing_pubs.size > 0 %}
<h2>Ongoing Research</h2>

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
