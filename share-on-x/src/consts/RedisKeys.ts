// Mọi Redis key của share-on-x khai báo tập trung ở đây, prefix `ap:sox:` (api share on x)
// để không đụng key của service khác dùng chung Redis instance. Phần động (id, wallet, ngày)
// do store ghép thêm sau base key.
export const RedisKeys = {
    SHARE: "ap:sox:share",
    RATE_LIMIT: "ap:sox:rl",
};
