export async function sendGetRequest<T>(url: string, withCredentials: boolean): Promise<T | null> {
    const isSecure = window.location.protocol === 'https:';
    try {
        const res = await fetch(url, {
            credentials: isSecure && withCredentials ? 'include' : 'omit',
        });
        if (!res.ok) return null;

        const data = (await res.json()) as IApiResponseData;
        if (!data.success) return null;

        if (typeof data.message === 'string') {
            try {
                return JSON.parse(data.message) as T;
            } catch {
                return data.message as unknown as T;
            }
        }
        return data.message as T;
    } catch {
        return null;
    }
}

interface IApiResponseData {
    success: boolean;
    error: string;
    message: any;
}
