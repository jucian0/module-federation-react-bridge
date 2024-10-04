import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";

export default defineConfig({
	server: {
		port: 3000,
	},
	tools: {
		rspack: (config, { appendPlugins }) => {
			appendPlugins([
				new ModuleFederationPlugin({
					name: "host",
					remotes: {
						remote: "remote@http://localhost:3001/mf-manifest.json",
						cart: "cart@http://localhost:3002/mf-manifest.json",
					},
					shared: ["react", "react-dom"],
					runtimePlugins: [require.resolve("./shared-strategy")]
				}),
			]);
		},
	},
	plugins: [pluginReact()],
});
