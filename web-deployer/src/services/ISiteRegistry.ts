export interface ISite {
    name: string;
    repo: string;
    branch: string;
    publishDir: string;
    installCmd: string[];
    buildCmd: string[];
    outputDir: string;
    // Where the built site is served. Display and notifications only - nothing
    // reads it back, so it never has to agree with what nginx actually serves.
    url?: string;
}

export interface IPublicSite {
    name: string;
    repo: string;
    branch: string;
    url?: string;
}

export default interface ISiteRegistry {
    list(): ISite[];

    get(name: string): ISite | undefined;

    toPublic(site: ISite): IPublicSite;
}
