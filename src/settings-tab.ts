import { App, PluginSettingTab, Setting } from "obsidian";
import SEOPlugin from "./main";
import { SEOSettings } from "./settings";

export class SEOSettingTab extends PluginSettingTab {
	plugin: SEOPlugin;

	constructor(app: App, plugin: SEOPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Scope' });

		// Directory settings
		new Setting(containerEl)
			.setName('Scan directories')
			.setDesc('Comma-separated list of directory names to scan. Leave blank to scan all directories.')
			.addText(text => text
				.setPlaceholder('e.g., blog, posts, public')
				.setValue(this.plugin.settings.scanDirectories)
				.onChange(async (value) => {
					this.plugin.settings.scanDirectories = value;
					await this.plugin.saveSettings();
				}));

		// Property names
		containerEl.createEl('h2', { text: 'Property Names' });

		new Setting(containerEl)
			.setName('Keyword property')
			.setDesc('Frontmatter property name for target keyword (e.g., targetKeyword, seo, keyword)')
			.addText(text => text
				.setPlaceholder('targetKeyword')
				.setValue(this.plugin.settings.keywordProperty)
				.onChange(async (value) => {
					this.plugin.settings.keywordProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Description property')
			.setDesc('Frontmatter property name for meta description')
			.addText(text => text
				.setPlaceholder('description')
				.setValue(this.plugin.settings.descriptionProperty)
				.onChange(async (value) => {
					this.plugin.settings.descriptionProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Title property')
			.setDesc('Frontmatter property name for title (leave blank to skip title checks)')
			.addText(text => text
				.setPlaceholder('title')
				.setValue(this.plugin.settings.titleProperty)
				.onChange(async (value) => {
					this.plugin.settings.titleProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use filename as title fallback')
			.setDesc('Use filename as title when title property is not set')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useFilenameAsTitle)
				.onChange(async (value) => {
					this.plugin.settings.useFilenameAsTitle = value;
					await this.plugin.saveSettings();
				}));

		// Check toggles
		containerEl.createEl('h2', { text: 'Check Options' });

		new Setting(containerEl)
			.setName('Check content length')
			.setDesc('Enable content length checking')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkContentLength)
				.onChange(async (value) => {
					this.plugin.settings.checkContentLength = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check image naming')
			.setDesc('Enable image filename checking')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkImageNaming)
				.onChange(async (value) => {
					this.plugin.settings.checkImageNaming = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check duplicate content')
			.setDesc('Enable duplicate content detection')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkDuplicateContent)
				.onChange(async (value) => {
					this.plugin.settings.checkDuplicateContent = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check reading level')
			.setDesc('Enable reading level analysis')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkReadingLevel)
				.onChange(async (value) => {
					this.plugin.settings.checkReadingLevel = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show notices')
			.setDesc('Show web compatibility notices (wikilinks, embedded images)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotices)
				.onChange(async (value) => {
					this.plugin.settings.showNotices = value;
					await this.plugin.saveSettings();
				}));

		// Thresholds
		containerEl.createEl('h2', { text: 'Thresholds' });

		new Setting(containerEl)
			.setName('Minimum content length')
			.setDesc('Minimum word count for content length check')
			.addText(text => text
				.setPlaceholder('300')
				.setValue(this.plugin.settings.minContentLength.toString())
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num)) {
						this.plugin.settings.minContentLength = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Keyword density minimum')
			.setDesc('Minimum keyword density percentage')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(this.plugin.settings.keywordDensityMin.toString())
				.onChange(async (value) => {
					const num = parseFloat(value);
					if (!isNaN(num)) {
						this.plugin.settings.keywordDensityMin = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Keyword density maximum')
			.setDesc('Maximum keyword density percentage')
			.addText(text => text
				.setPlaceholder('2')
				.setValue(this.plugin.settings.keywordDensityMax.toString())
				.onChange(async (value) => {
					const num = parseFloat(value);
					if (!isNaN(num)) {
						this.plugin.settings.keywordDensityMax = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Duplicate content threshold')
			.setDesc('Similarity percentage threshold for duplicate content detection')
			.addText(text => text
				.setPlaceholder('80')
				.setValue(this.plugin.settings.duplicateThreshold.toString())
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num)) {
						this.plugin.settings.duplicateThreshold = num;
						await this.plugin.saveSettings();
					}
				}));
	}
}
