import {IBuildSnapshot} from "./IBuildSnapshot";
import {IDeployMeta} from "./IDeployRunner";

export default interface IBuildClient {
    trigger(siteName: string, commit: string, meta: IDeployMeta): Promise<void>;

    previewPr(siteName: string, prNumber: number, actor: string): Promise<void>;

    rollback(siteName: string, commit: string, actor: string): Promise<void>;

    snapshot(): Promise<IBuildSnapshot>;
}
