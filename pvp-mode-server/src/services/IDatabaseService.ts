export default interface IDatabaseService {
    query(sql: string, params?: any[]): Promise<any>;
}
