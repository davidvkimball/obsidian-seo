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

		containerEl.createEl('h2', { text: 'Global' });

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

		new Setting(containerEl)
			.setName('Use note titles instead of file names')
			.setDesc('Display note titles from frontmatter instead of file names in the issues list and current note audit')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useNoteTitles)
				.onChange(async (value) => {
					this.plugin.settings.useNoteTitles = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Title prefix / suffix')
			.setDesc('Specify an optional prefix or suffix that gets appended to your meta title - used to factor in character count for the title length check')
			.addText(text => text
				.setPlaceholder('- Author Name')
				.setValue(this.plugin.settings.titlePrefixSuffix)
				.onChange(async (value) => {
					this.plugin.settings.titlePrefixSuffix = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Ignores files with an underscore prefix')
			.setDesc('Don\'t process files that begin with an underscore, like _example.md')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ignoreUnderscoreFiles)
				.onChange(async (value) => {
					this.plugin.settings.ignoreUnderscoreFiles = value;
					await this.plugin.saveSettings();
				}));

		// Property names
		containerEl.createEl('h2', { text: 'Property Names' });

		new Setting(containerEl)
			.setName('Keyword property')
			.setDesc('Property name for target keyword (e.g., targetKeyword, seo, keyword)')
			.addText(text => text
				.setPlaceholder('targetKeyword')
				.setValue(this.plugin.settings.keywordProperty)
				.onChange(async (value) => {
					this.plugin.settings.keywordProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Description property')
			.setDesc('Property name for meta description')
			.addText(text => text
				.setPlaceholder('description')
				.setValue(this.plugin.settings.descriptionProperty)
				.onChange(async (value) => {
					this.plugin.settings.descriptionProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Title property')
			.setDesc('Property name for title (leave blank to skip title checks)')
			.addText(text => text
				.setPlaceholder('title')
				.setValue(this.plugin.settings.titleProperty)
				.onChange(async (value) => {
					this.plugin.settings.titleProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use file name as title')
			.setDesc('Use file name as title instead of a property')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useFilenameAsTitle)
				.onChange(async (value) => {
					this.plugin.settings.useFilenameAsTitle = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Slug property')
			.setDesc('Property name for slug (leave blank to skip slug checks)')
			.addText(text => text
				.setPlaceholder('slug')
				.setValue(this.plugin.settings.slugProperty)
				.onChange(async (value) => {
					this.plugin.settings.slugProperty = value;
					await this.plugin.saveSettings();
				}));

		const useFilenameAsSlugSetting = new Setting(containerEl)
			.setName('Use file/folder name as slug')
			.setDesc('Use file/folder name as slug instead of a property')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useFilenameAsSlug)
				.onChange(async (value) => {
					this.plugin.settings.useFilenameAsSlug = value;
					await this.plugin.saveSettings();
					// Re-render to show/hide the parent folder option
					this.display();
				}));

		// Show parent folder option only when useFilenameAsSlug is enabled
		if (this.plugin.settings.useFilenameAsSlug) {
			new Setting(containerEl)
				.setName('Use parent folder name instead when specified file name is used')
				.setDesc('If a markdown file matches this file name, use the parent folder name as the slug instead')
				.addText(text => text
					.setPlaceholder('index')
					.setValue(this.plugin.settings.parentFolderSlugFilename)
					.onChange(async (value) => {
						this.plugin.settings.parentFolderSlugFilename = value;
						await this.plugin.saveSettings();
					}));
		}

		// Check toggles - in correct order
		containerEl.createEl('h2', { text: 'Audit Options' });

		new Setting(containerEl)
			.setName('Check meta title length')
			.setDesc('Enable meta title length checking')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkTitleLength)
				.onChange(async (value) => {
					this.plugin.settings.checkTitleLength = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check heading order')
			.setDesc('Enable heading hierarchy checking')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkHeadingOrder)
				.onChange(async (value) => {
					this.plugin.settings.checkHeadingOrder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check content length')
			.setDesc('Enable content length checking')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkContentLength)
				.onChange(async (value) => {
					this.plugin.settings.checkContentLength = value;
					await this.plugin.saveSettings();
				}));

		// Duplicate content check with performance warning
		const duplicateContentSetting = new Setting(containerEl)
			.setName('Check duplicate content')
			.setDesc('Enable duplicate content detection')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkDuplicateContent)
				.onChange(async (value) => {
					this.plugin.settings.checkDuplicateContent = value;
					await this.plugin.saveSettings();
				}));

		// Add performance warning
		const warningEl = duplicateContentSetting.descEl.createEl('div', {
			text: '⚠️ WARNING: This feature can be very resource-intensive with large vaults and many notes. Disable for faster audits.',
			cls: 'setting-item-description'
		});
		warningEl.style.color = '#ff6b6b';
		warningEl.style.fontWeight = 'bold';

		warningEl.style.marginTop = '4px';

		new Setting(containerEl)
			.setName('Check alt text')
			.setDesc('Enable alt text checking for images')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkAltText)
				.onChange(async (value) => {
					this.plugin.settings.checkAltText = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check image file names')
			.setDesc('Enable image file name checking')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkImageNaming)
				.onChange(async (value) => {
					this.plugin.settings.checkImageNaming = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check broken internal links')
			.setDesc('Enable broken internal link detection')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkBrokenLinks)
				.onChange(async (value) => {
					this.plugin.settings.checkBrokenLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check external links')
			.setDesc('Return a list of external links')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkExternalLinks)
				.onChange(async (value) => {
					this.plugin.settings.checkExternalLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable broken external link check button')
			.setDesc('Show "Check external links for 404s" button in current note panel')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableExternalLinkButton)
				.onChange(async (value) => {
					this.plugin.settings.enableExternalLinkButton = value;
					await this.plugin.saveSettings();
					// Refresh the side panel if it exists
					if (this.plugin.sidePanel) {
						this.plugin.sidePanel.refresh();
					}
				}));

		new Setting(containerEl)
			.setName('Check naked links')
			.setDesc('Enable naked URL detection')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkNakedLinks)
				.onChange(async (value) => {
					this.plugin.settings.checkNakedLinks = value;
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
			.setName('Check potentially broken links')
			.setDesc('Check for potentially broken internal links that may not work on web publishing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkPotentiallyBrokenLinks)
				.onChange(async (value) => {
					this.plugin.settings.checkPotentiallyBrokenLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Check potentially broken embeds')
			.setDesc('Check for potentially broken markdown or wikilink-based embedded media that may not work on web publishing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.checkPotentiallyBrokenEmbeds)
				.onChange(async (value) => {
					this.plugin.settings.checkPotentiallyBrokenEmbeds = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Flexible relative link check')
			.setDesc('Uses flexible validation for relative paths like /page that can be resolved by a static site generator, but may be considered broken by typical Obsidian validation')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.publishMode)
				.onChange(async (value) => {
					this.plugin.settings.publishMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Title property is H1')
			.setDesc('Enable when your static site generator uses the title frontmatter property to automatically generate the H1 heading. This prevents H1 validation errors while still flagging H1s that appear after other heading levels.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.skipH1Check)
				.onChange(async (value) => {
					this.plugin.settings.skipH1Check = value;
					await this.plugin.saveSettings();
				}));

		const vaultCheckSetting = new Setting(containerEl)
			.setName('Automatically include broken external link checks in audits (not recommended)')
			.setDesc('Include broken external link checking in vault-wide and current note audits')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableExternalLinkVaultCheck)
				.onChange(async (value) => {
					this.plugin.settings.enableExternalLinkVaultCheck = value;
					await this.plugin.saveSettings();
					// Refresh the side panel if it exists
					if (this.plugin.sidePanel) {
						this.plugin.sidePanel.refresh();
					}
				}));

		// Add warning for vault-wide external link checking
		const vaultWarningEl = vaultCheckSetting.descEl.createEl('div', {
			text: '⚠️ WARNING: This will make vault audits extremely slow. Use the "Check external links" button instead for individual notes.',
			cls: 'setting-item-description'
		});
		vaultWarningEl.style.color = '#ff6b6b';
		vaultWarningEl.style.fontWeight = 'bold';
		vaultWarningEl.style.marginTop = '4px';

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
