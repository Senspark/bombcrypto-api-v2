import Urls from "../../consts/Urls";
import {IApiError, IConfirmResult, IPreviewBody, Network} from "./PayRockData";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: IApiError };

export async function previewPayRock(tx: string, network: Network): Promise<ApiResult<IPreviewBody>> {
    return postJson<IPreviewBody>(Urls.PayRockPreview, {tx, network});
}

export async function confirmPayRock(tx: string, network: Network, acceptedRock: number): Promise<ApiResult<IConfirmResult>> {
    return postJson<IConfirmResult>(Urls.PayRockConfirm, {tx, network, acceptedRock});
}

async function postJson<T>(url: string, body: any): Promise<ApiResult<T>> {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        });
        return await parseResponse<T>(res);
    } catch (e) {
        return {ok: false, status: 0, error: {error: (e as Error).message || 'network error'}};
    }
}

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
    let body: any = null;
    try {
        body = await res.json();
    } catch {
        // ignore — leave body null
    }
    if (res.ok) {
        return {ok: true, data: body as T};
    }
    const err: IApiError = (body && typeof body === 'object')
        ? body
        : {error: `HTTP ${res.status}`};
    return {ok: false, status: res.status, error: err};
}
