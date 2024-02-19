import { dev as env } from "../bin/environments";

const { project, region, environment } = env;

export const createName = (resource: string, functionality: string) =>
    `${project}-${region}-${resource}-${environment}-${functionality}`;
