package slack

import (
	"fmt"
	neturl "net/url"
	"regexp"
	"strings"
)

var permalinkPattern = regexp.MustCompile(`https://[a-z0-9.-]+\.slack\.com/archives/([A-Z0-9]+)/p(\d{10})(\d{6})(?:\?([^\s|>]+))?`)

type Permalink struct {
	URL      string
	Channel  string
	ThreadTs string
}

type LinkedThread struct {
	URL      string
	Messages []Message
	Err      error
}

func FindPermalinks(text string) []Permalink {
	var links []Permalink
	seen := map[string]bool{}
	for _, m := range permalinkPattern.FindAllStringSubmatch(text, -1) {
		// Unescape because Slack HTML-escapes "&" in event text.
		url := strings.ReplaceAll(m[0], "&amp;", "&")
		link := Permalink{URL: url, Channel: m[1], ThreadTs: m[2] + "." + m[3]}
		if query, err := neturl.ParseQuery(strings.ReplaceAll(m[4], "&amp;", "&")); err == nil && query.Get("thread_ts") != "" {
			link.ThreadTs = query.Get("thread_ts")
		}
		key := link.Channel + "/" + link.ThreadTs
		if seen[key] {
			continue
		}
		seen[key] = true
		links = append(links, link)
	}
	return links
}

func BuildAskWithLinkedThreads(ask string, threads []LinkedThread) string {
	var b strings.Builder
	b.WriteString(ask)
	b.WriteString("\n\nLinked Slack threads (already fetched; these URLs require Slack sign-in, so do not fetch them):\n")
	for _, t := range threads {
		b.WriteString(t.URL + "\n")
		if t.Err != nil {
			b.WriteString(fmt.Sprintf("- could not be read: %v\n", t.Err))
			continue
		}
		for _, m := range t.Messages {
			if m.Text != "" {
				b.WriteString(fmt.Sprintf("- %s\n", m.Text))
			}
			for _, a := range m.Attachments {
				if a.Text != "" {
					b.WriteString(fmt.Sprintf("- %s\n", a.Text))
				}
			}
		}
	}
	return b.String()
}
