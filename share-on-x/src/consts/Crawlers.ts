// Link-preview / social crawlers fetch the OG meta; everyone else is a human we
// bounce home. Real crawlers send an identifiable UA and don't run JS, so a
// server-side split (meta for crawlers, 302 for humans) beats a client-side
// redirect — humans jump instantly and crawlers never lose the meta.
const CRAWLER_UA = /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|pinterest|linkedinbot|applebot|skypeuripreview|embedly|iframely|redditbot|vkshare|w3c_validator|preview|google-inspectiontool/i;

// Unknown/empty UA → treat as crawler so an unlisted preview bot still gets meta.
// A real browser always sends a UA, so humans are never misclassified this way.
export function isCrawler(userAgent: string | undefined): boolean {
    if (!userAgent) {
        return true;
    }
    return CRAWLER_UA.test(userAgent);
}
