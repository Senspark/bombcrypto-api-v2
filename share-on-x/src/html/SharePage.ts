import {HOME_URL} from "../consts/Consts";

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export interface SharePageInput {
    pageUrl: string;
    imageUrl: string;
    title: string;
    description: string;
}

// Crawler-only page: just OG/Twitter meta + a link home. No client-side redirect
// — a redirect would make JS-rendering OG parsers (opengraph.xyz, etc.) navigate
// to '/' and report our tags as "missing". Humans are 302'd home server-side
// (RenderShareHandler) and never reach this page; the link is a fallback only.
export function buildSharePage(input: SharePageInput): string {
    const pageUrl = escapeHtml(input.pageUrl);
    const imageUrl = escapeHtml(input.imageUrl);
    const title = escapeHtml(input.title);
    const description = escapeHtml(input.description);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <title>${title}</title>
</head>
<body><a href="${HOME_URL}">Enter Bombcrypto</a></body>
</html>`;
}
