// TypeScript definitions for citation-js
declare module "@citation-js/core" {
	export default class Cite {
		constructor(data?: any);
		static add(plugin: any): void;
		// static plugins: {
		// 	config: {
		// 		get(s: string): any;
		// 	};
		// };
		format(format: string, options?: any): any;
	}
}

declare module "@citation-js/plugin-bibtex" {
	const plugin: any;
	export default plugin;
}

declare module "@citation-js/plugin-doi" {
	const plugin: any;
	export default plugin;
}

declare module "@citation-js/plugin-isbn" {
	const plugin: any;
	export default plugin;
}
