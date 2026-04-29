import IEnvConfig from "../services/IEnvConfig";
import dotenv from "dotenv";

dotenv.config();

export default class EnvConfig implements IEnvConfig {
    port = parseInt(process.env.PORT || "3006");
    postgresConnectionString = process.env.POSTGRES_CONNECTION_STRING || "postgresql://postgres:postgres@localhost:5432/postgres";
    isProduction = process.env.NODE_ENV === "production";
}
