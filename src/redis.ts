import { RedisClient } from "redis";
import { debug } from "debug";
import util from "util";
import { Listing, RedditUser, Submission, SubredditMode } from "./reddit";

const logger = debug("rdb:redis");

let redis = new RedisClient({
    port: parseInt(process.env.REDIS_PORT!),
    host: process.env.REDIS_HOST!,
    password: process.env.REDIS_PASSWORD!,
    no_ready_check: true,
    enable_offline_queue: false,
});

redis.on("error", (err) => {
    logger("error", err);
});

const setAsync = util.promisify(redis.set).bind(redis);
const getAsync = util.promisify(redis.get).bind(redis);
const setExAsync = util.promisify(redis.setex).bind(redis);

const EXPIRE_USER_ICON = 60 * 60;
const EXPIRE_SUBREDDIT_ICON = 60 * 60;
const EXPIRE_URL = 60 * 60;
const EXPIRE_CHANNEL_INDEX = 60 * 60;
const EXPIRE_USER_INPUT = 60 * 60;

function getTtlForRedditMode(mode: SubredditMode) {
    switch (mode) {
        case "hour":
            return 60 * 60;
        case "day":
            return 60 * 60 * 24;
        case "week":
            return 60 * 60 * 24 * 7;
        case "month":
            return 60 * 60 * 24 * 30;
        case "year":
        case "all":
            return 60 * 60 * 24 * 30 * 3; // will probably forget after 3 months
        default:
            return 60 * 60 * 16;
    }
}

export async function storeCachedRedditListing(
    subreddit: string,
    subredditMode: SubredditMode,
    page: number,
    submissions: Listing<Submission>
) {
    await setExAsync(
        `reddit:${subreddit}:${subredditMode}:${page}`,
        getTtlForRedditMode(subredditMode),
        JSON.stringify(submissions)
    );
}

export async function getCachedRedditListing(
    subreddit: string,
    subredditMode: SubredditMode,
    page: number
): Promise<Listing<Submission> | null> {
    return JSON.parse((await getAsync(`reddit:${subreddit}:${subredditMode}:${page}`)) ?? "null");
}

export async function getCachedRedditUserIcon(userName: string): Promise<string | null> {
    return await getAsync(`user:${userName}:icon`);
}

export async function storeCachedRedditUserIcon(userName: string, icon: string) {
    await setExAsync(`user:${userName}:icon`, EXPIRE_USER_ICON, icon);
}

export async function getCachedSubredditIcon(subredditName: string): Promise<string | null> {
    return await getAsync(`reddit:${subredditName}:icon`);
}

export async function storeCachedSubredditIcon(subredditName: string, icon: string) {
    await setExAsync(`reddit:${subredditName}:icon`, EXPIRE_SUBREDDIT_ICON, icon);
}

export async function getCachedPackedUrl(url: string): Promise<string | null> {
    return await getAsync(`url:${url}`);
}

export async function storeCachedPackedUrl(url: string, unpackedUrl: string) {
    await setExAsync(`url:${url}`, EXPIRE_URL, unpackedUrl);
}

export async function getChannelIndex(channelId: string, subreddit: string, subredditMode: string): Promise<number> {
    return parseInt((await getAsync(`channel:${channelId}:${subreddit}:${subredditMode}:index`)) ?? "0");
}

export async function storeChannelIndex(channelId: string, subreddit: string, subredditMode: string, index: number) {
    await setExAsync(`channel:${channelId}:${subreddit}:${subredditMode}:index`, EXPIRE_CHANNEL_INDEX, "" + index);
}

export async function storePreviousInput(channelId: string, userId: string, input: string) {
    await setExAsync(`channel:${channelId}:${userId}:prev`, EXPIRE_USER_INPUT, input);
}

export async function getPreviousInput(channelId: string, userId: string): Promise<string | null> {
    return await getAsync(`channel:${channelId}:${userId}:prev`);
}
