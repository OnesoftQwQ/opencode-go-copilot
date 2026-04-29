/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// version: 5

declare module "vscode" {
	/**
	 * The provider version of {@linkcode LanguageModelChatRequestOptions}
	 */
	export interface ProvideLanguageModelChatResponseOptions {
		/**
		 * What extension initiated the request to the language model, or
		 * `undefined` if the request was initiated by other functionality in the editor.
		 */
		readonly requestInitiator: string;

		/**
		 * Per-model configuration provided by the user. This contains values configured
		 * in the user's language models configuration file, validated against the model's
		 * {@linkcode LanguageModelChatInformation.configurationSchema configurationSchema}.
		 */
		readonly modelConfiguration?: {
			readonly [key: string]: any;
		};
	}

	/**
	 * All the information representing a single language model contributed by a {@linkcode LanguageModelChatProvider}.
	 */
	export interface LanguageModelChatInformation {
		/**
		 * When present, this gates the use of `requestLanguageModelAccess` behind an authorization flow where
		 * the user must approve of another extension accessing the models contributed by this extension.
		 * Additionally, the extension can provide a label that will be shown in the UI.
		 * A common example of a label is an account name that is signed in.
		 *
		 */
		requiresAuthorization?: true | { label: string };

		/**
		 * Whether or not this will be selected by default in the model picker
		 * NOT BEING FINALIZED
		 */
		readonly isDefault?: boolean | { [K in ChatLocation]?: boolean };

		/**
		 * Whether or not the model will show up in the model picker immediately upon being made known via {@linkcode LanguageModelChatProvider.provideLanguageModelChatInformation}.
		 * NOT BEING FINALIZED
		 */
		readonly isUserSelectable?: boolean;

		/**
		 * Optional category to group models by in the model picker.
		 * The lower the order, the higher the category appears in the list.
		 * Has no effect if `isUserSelectable` is `false`.
		 *
		 * WONT BE FINALIZED
		 */
		readonly category?: { label: string; order: number };

		readonly statusIcon?: ThemeIcon;

		/**
		 * An optional JSON schema describing the configuration options for this model.
		 * When set, users can specify per-model configuration in their language models
		 * configuration file. The configured values are merged into the request options
		 * when sending chat requests to this model.
		 */
		readonly configurationSchema?: LanguageModelConfigurationSchema;
	}

	export interface LanguageModelChatCapabilities {
		/**
		 * The tools the model prefers for making file edits. If not provided or if none of the tools,
		 * are recognized, the editor will try multiple edit tools and pick the best one. The available
		 * edit tools WILL change over time and this capability only serves as a hint to the editor.
		 *
		 * Edit tools currently recognized include:
		 * - 'find-replace': Find and replace text in a document.
		 * - 'multi-find-replace': Find and replace multiple text snippets across documents.
		 * - 'apply-patch': A file-oriented diff format used by some OpenAI models
		 * - 'code-rewrite': A general but slower editing tool that allows the model
		 *   to rewrite and code snippet and provide only the replacement to the editor.
		 *
		 * The order of edit tools in this array has no significance; all of the recognized edit
		 * tools will be made available to the model.
		 */
		readonly editTools?: string[];
	}

	export type LanguageModelResponsePart2 =
		| LanguageModelResponsePart
		| LanguageModelDataPart
		| LanguageModelThinkingPart;

	/**
	 * A [JSON Schema](https://json-schema.org) describing configuration options for a language model.
	 * Each property in `properties` defines a configurable option using standard JSON Schema fields
	 * plus additional display hints.
	 */
	export type LanguageModelConfigurationSchema = {
		readonly properties?: {
			readonly [key: string]: Record<string, any> & {
				/**
				 * Human-readable labels for enum values, shown instead of the raw values.
				 * Must have the same length and order as `enum`.
				 */
				readonly enumItemLabels?: string[];
				/**
				 * Human-readable descriptions for enum values.
				 */
				readonly enumDescriptions?: string[];
				/**
				 * The group this property belongs to. When set to `'navigation'`, the property
				 * is shown as a primary action in the model picker.
				 */
				readonly group?: string;
			};
		};
	};

	export interface LanguageModelChatProvider<T extends LanguageModelChatInformation = LanguageModelChatInformation> {
		provideLanguageModelChatInformation(options: PrepareLanguageModelChatModelOptions, token: CancellationToken): ProviderResult<T[]>;
		provideLanguageModelChatResponse(
			model: T,
			messages: readonly LanguageModelChatRequestMessage[],
			options: ProvideLanguageModelChatResponseOptions,
			progress: Progress<LanguageModelResponsePart2>,
			token: CancellationToken
		): Thenable<void>;
	}

	/**
	 * The list of options passed into {@linkcode LanguageModelChatProvider.provideLanguageModelChatInformation}
	 */
	export interface PrepareLanguageModelChatModelOptions {
		/**
		 * Whether the provider is being called silently (e.g., for background refresh).
		 */
		readonly silent: boolean;
		/**
		 * Configuration for the model. This is only present if the provider has declared
		 * that it requires configuration via the `configuration` property.
		 * The object adheres to the schema that the extension provided during declaration.
		 */
		readonly configuration?: {
			readonly [key: string]: any;
		};
	}
}
