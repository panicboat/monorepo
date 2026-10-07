package slack

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestFindPermalinks(t *testing.T) {
	cases := []struct {
		name string
		text string
		want []Permalink
	}{
		{
			name: "top-level message link resolves to its own ts",
			text: "<@BOT> see <https://example.slack.com/archives/C123ABC/p1700000000123456>",
			want: []Permalink{{
				URL:      "https://example.slack.com/archives/C123ABC/p1700000000123456",
				Channel:  "C123ABC",
				ThreadTs: "1700000000.123456",
			}},
		},
		{
			name: "reply link resolves to the thread parent ts",
			text: "<https://example.slack.com/archives/C123ABC/p1700000050654321?thread_ts=1700000000.000100&amp;cid=C123ABC>",
			want: []Permalink{{
				URL:      "https://example.slack.com/archives/C123ABC/p1700000050654321?thread_ts=1700000000.000100&cid=C123ABC",
				Channel:  "C123ABC",
				ThreadTs: "1700000000.000100",
			}},
		},
		{
			name: "labelled link excludes the label",
			text: "<https://example.slack.com/archives/C123ABC/p1700000000123456|this thread>",
			want: []Permalink{{
				URL:      "https://example.slack.com/archives/C123ABC/p1700000000123456",
				Channel:  "C123ABC",
				ThreadTs: "1700000000.123456",
			}},
		},
		{
			name: "links into the same thread are returned once",
			text: "<https://example.slack.com/archives/C123ABC/p1700000000000100>\n" +
				"<https://example.slack.com/archives/C123ABC/p1700000050654321?thread_ts=1700000000.000100&amp;cid=C123ABC>",
			want: []Permalink{{
				URL:      "https://example.slack.com/archives/C123ABC/p1700000000000100",
				Channel:  "C123ABC",
				ThreadTs: "1700000000.000100",
			}},
		},
		{
			name: "links into different threads are all returned in order",
			text: "<https://example.slack.com/archives/C111/p1700000000000001> <https://example.slack.com/archives/G222/p1700000000000002>",
			want: []Permalink{
				{URL: "https://example.slack.com/archives/C111/p1700000000000001", Channel: "C111", ThreadTs: "1700000000.000001"},
				{URL: "https://example.slack.com/archives/G222/p1700000000000002", Channel: "G222", ThreadTs: "1700000000.000002"},
			},
		},
		{
			name: "non-Slack links are ignored",
			text: "<https://github.com/panicboat/monorepo/archives/C123ABC/p1700000000123456>",
			want: nil,
		},
		{
			name: "text without links yields nothing",
			text: "investigate the frontend pod",
			want: nil,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FindPermalinks(tc.text)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("FindPermalinks(%q) = %+v, want %+v", tc.text, got, tc.want)
			}
		})
	}
}

func TestBuildAskWithLinkedThreads_IncludesMessageText(t *testing.T) {
	got := BuildAskWithLinkedThreads("what happened here?", []LinkedThread{{
		URL: "https://example.slack.com/archives/C123ABC/p1700000000123456",
		Messages: []Message{
			{Text: "deploy failed at 10:00"},
			{Text: "rolled back"},
		},
	}})

	for _, want := range []string{
		"what happened here?",
		"https://example.slack.com/archives/C123ABC/p1700000000123456",
		"deploy failed at 10:00",
		"rolled back",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("expected result to contain %q, got: %s", want, got)
		}
	}
}

func TestBuildAskWithLinkedThreads_IncludesAttachmentText(t *testing.T) {
	got := BuildAskWithLinkedThreads("why did this fire?", []LinkedThread{{
		URL: "https://example.slack.com/archives/C123ABC/p1700000000123456",
		Messages: []Message{
			{Attachments: []Attachment{{Text: "KubePodCrashLooping firing"}}},
		},
	}})

	if !strings.Contains(got, "KubePodCrashLooping firing") {
		t.Errorf("expected result to contain attachment text, got: %s", got)
	}
}

func TestBuildAskWithLinkedThreads_ReportsUnreadableThread(t *testing.T) {
	got := BuildAskWithLinkedThreads("what happened here?", []LinkedThread{{
		URL: "https://example.slack.com/archives/C123ABC/p1700000000123456",
		Err: errors.New("slack api error: not_in_channel"),
	}})

	if !strings.Contains(got, "https://example.slack.com/archives/C123ABC/p1700000000123456") {
		t.Errorf("expected result to name the unreadable link, got: %s", got)
	}
	if !strings.Contains(got, "slack api error: not_in_channel") {
		t.Errorf("expected result to contain the failure reason, got: %s", got)
	}
}
