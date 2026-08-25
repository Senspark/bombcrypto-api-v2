import {IBuildSnapshot} from "./IBuildSnapshot";
import {IDeployMeta} from "./IDeployRunner";

export default interface IBuildClient {
    trigger(siteName: string, commit: string, meta: IDeployMeta): Promise<void>;

    snapshot(): Promise<IBuildSnapshot>;
}
