import nodeHtmlToImage from 'node-html-to-image';
import { compile } from 'svelte/compiler';
import {LoggerDelegate} from "../../utils/logger/logger-delegate.js";
import {dirname, join} from "path";
import {fileURLToPath} from "url";
import fs from "fs";

export class WebComponentToImageBuilder {
    private readonly _logger: LoggerDelegate;
    private readonly _props: string;
    private readonly _webComponentFileName: string;

    public constructor(webComponentFileName: string, props: any) {
        this._logger = new LoggerDelegate(WebComponentToImageBuilder.name);
        this._props = props;
        this._webComponentFileName = webComponentFileName;

        const __dirname = dirname(fileURLToPath(import.meta.url));
        const pathToSvelteComponent = join(__dirname, `/web-components/svelte/src/${webComponentFileName}`);
        this._logger.debug(`pathToSvelteComponent = ${pathToSvelteComponent}`);

        try {
            this._logger.info(`Compiling web component into js...`);

            const webComponentCode = fs.readFileSync(pathToSvelteComponent, 'utf-8');
            const object = compile(webComponentCode, {
                generate: 'ssr'
            });

            this._logger.info(`Saving web component js to file system...`);
            fs.writeFileSync(`${process.env.SERVER_FILE_TEMP_STORE}/${webComponentFileName}-compiled.js`, object.js.code, 'utf8');
        } catch (e) {
            this._logger.error(e);
        }
    }

    public async buildImage(desiredImageFileName: string) {
        try {
            this._logger.info(`Rendering web component html...`)
            const component = await import(`${process.env.SERVER_FILE_TEMP_STORE}/${this._webComponentFileName}-compiled.js`);
            const rendered = component.default.render(this._props);
            this._logger.debug(`renderedHtml = ${JSON.stringify(rendered)}`);

            this._logger.info(`Building image from rendered html...`)
            const imageHtml = '<body><style>' + rendered.css.code + '</style>' + rendered.html + '</body>';
            this._logger.debug(`rendered HTML plus css = ${imageHtml}`);
            const image = await nodeHtmlToImage({
                html: imageHtml,
                quality: 100,
                type: 'jpeg',
                output: `${process.env.SERVER_FILE_TEMP_STORE}/${desiredImageFileName}`,
                encoding: 'binary'
            });

            this._logger.debug(`Finished building image from template.`);
            return image;
        } catch(e) {
            this._logger.error(`Error building image: ${e}`);
        }
    }
}
