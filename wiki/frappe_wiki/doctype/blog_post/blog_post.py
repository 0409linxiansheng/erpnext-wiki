# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.model.document import Document


class BlogPost(Document):
	def validate(self):
		if not self.slug:
			self.slug = self._slug() or frappe.generate_hash(length=10).lower()
		self._ensure_unique_slug()
		if not self.published_on:
			self.published_on = frappe.utils.today()

	def _slug(self) -> str:
		"""A URL-safe slug from the title.

		Only ASCII survives; a Chinese title produces nothing usable, so it falls
		back to a short hash rather than an empty segment. Authors who care about
		the URL can type one.
		"""
		title = (self.title or "").strip().lower()
		candidate = re.sub(r"[^a-z0-9]+", "-", title).strip("-")
		return candidate[:120] if len(candidate) >= 3 else ""

	def _ensure_unique_slug(self) -> None:
		if not self.slug:
			return
		existing = frappe.db.get_value("Blog Post", {"slug": self.slug}, "name")
		if existing and existing != self.name:
			frappe.throw(_("The slug '{0}' is already used by another post.").format(self.slug))
