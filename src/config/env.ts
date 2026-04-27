import "dotenv/config";
import { config } from "dotenv";

config({ path: process.env.PAWTROL_ENV_PATH || ".env.local", override: false });
