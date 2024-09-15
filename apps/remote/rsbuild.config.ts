import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";

export default defineConfig({
	server: {
		port: 3001,
	},
	dev: {
		// It is necessary to configure assetPrefix, and in the production build, you need to configure output.assetPrefix
		assetPrefix: "http://localhost:3001",
	},
	tools: {
		rspack: (config, { appendPlugins }) => {
			// You need to set a unique value that is not equal to other applications
			config.output!.uniqueName = "remote";
			appendPlugins([
				new ModuleFederationPlugin({
					name: "remote",
					exposes: {
						"./app": "./src/app.tsx",
					},
					shared: ["react", "react-dom"],
				}),
			]);
		},
	},
	plugins: [pluginReact()],
});
