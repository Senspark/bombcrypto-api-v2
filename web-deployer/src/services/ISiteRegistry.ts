export interface ISite {
    name: string;
    repo: string;
    branch: string;
    // Where a build lands. Nothing else writes here.
    previewDir: string;
    // Production web root. Only a deploy-branch build and a rollback write it.
    publishDir: string;
    installCmd: string[];
    buildCmd: string[];
    outputDir: string;
    // Where the built site is served. Display and notifications only - nothing
    // reads it back, so it never has to agree with what nginx actually serves.
    url?: string;
    previewUrl?: string;
}

export interface IPublicSite {
    name: string;
    repo: string;
    branch: string;
    url?: string;
    previewUrl?: string;
}

export default interface ISiteRegistry {
    list(): ISite[];

    get(name: string): ISite | undefined;

    toPublic(site: ISite): IPublicSite;
}
