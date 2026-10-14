"""The portal's view model — pure, so its rules are unit-tested instead of read
out of Jinja.

`wiki/www/portal.py` hands this the `Wiki Portal` single and the public space rows;
the template renders what comes back.
"""

def _field(config, name, default=None):
	"""Read a field from a Document, a dict, or nothing at all."""
	if config is None:
		return default
	if hasattr(config, "get"):
		value = config.get(name)
	else:
		value = getattr(config, name, None)
	return default if value is None else value


def _text(config, name, default):
	value = _field(config, name)
	return (str(value).strip() if value else "") or default


def build_portal_view(config, spaces, defaults=None) -> dict:
	"""Apply the `Wiki Portal` config to the public space rows.

	`defaults` carries the fallback heading and subtitle. They are UI strings, so
	they are translated where the language is actually known — the caller — rather
	than buried here, where nothing can translate them.

	`spaces` are rows from `get_public_spaces()`, so they are public by
	construction: a featured entry naming anything else is dropped, because the
	portal must never advertise a space a visitor cannot open.

	Featured spaces keep the row order and lead the list; when `show_all_spaces` is
	off they are the whole list.
	"""
	rows = list(spaces or [])
	by_name = {row["name"]: row for row in rows}

	featured = []
	for entry in _field(config, "featured_spaces") or []:
		name = entry.get("wiki_space") if hasattr(entry, "get") else getattr(entry, "wiki_space", None)
		row = by_name.get(name)
		if row is not None and row not in featured:
			featured.append(row)

	if _field(config, "show_all_spaces", 1):
		ordered = featured + [row for row in rows if row not in featured]
	else:
		ordered = featured

	defaults = defaults or {}

	return {
		"title": _text(config, "title", defaults.get("title", "")),
		"subtitle": _text(config, "subtitle", defaults.get("subtitle", "")),
		"logo": _field(config, "logo") or "",
		"accent_color": _field(config, "accent_color") or "",
		"footer_text": _text(config, "footer_text", ""),
		"spaces": ordered,
	}
