export class Singleton {
    private static _instance: Singleton;

    protected constructor() {}

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }
}
