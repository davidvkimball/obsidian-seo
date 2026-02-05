import { App, PluginSettingTab } from "obsidian";
import SEOPlugin from "./main";
import { createSettingsGroup } from "./utils/settings-compat";

export class SEOSettingTab extends PluginSettingTab {
	plugin: SEOPlugin;
	public icon = 'lucide-search-check';

	constructor(app: App, plugin: SEOPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Global group
		const globalGroup = createSettingsGroup(containerEl, 'Global', 'seo');

		globalGroup.addSetting((setting) => {
			setting
				.setName('Scan directories')
				.setDesc('Comma-separated list of directory names to scan. Leave blank to scan all directories.')
				.addText(text => {
					// False positive: "like blog, posts, public" is a placeholder example, not UI text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text.setPlaceholder('like blog, posts, public');
					text.setValue(this.plugin.settings.scanDirectories);
					text.onChange(async (value) => {
						this.plugin.settings.scanDirectories = value;
						await this.plugin.saveSettings();
					});
				});
		});

		globalGroup.addSetting((setting) => {
			setting
				.setName('Use note titles instead of file names')
				.setDesc('Display note titles from properties instead of file names in the issues list and current note audit')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.useNoteTitles)
					.onChange(async (value) => {
						this.plugin.settings.useNoteTitles = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting((setting) => {
			setting
				.setName('Title prefix / suffix')
				.setDesc('Specify an optional prefix or suffix that gets appended to your meta title - used to factor in character count for the title length check')
				.addText(text => text
					.setPlaceholder('Author name')
					.setValue(this.plugin.settings.titlePrefixSuffix)
					.onChange(async (value) => {
						this.plugin.settings.titlePrefixSuffix = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting((setting) => {
			setting
				.setName('Ignores files with an underscore prefix')
				.setDesc('Don\'t process files that begin with an underscore, like _example.md')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.ignoreUnderscoreFiles)
					.onChange(async (value) => {
						this.plugin.settings.ignoreUnderscoreFiles = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting((setting) => {
			setting
				// False positive: "MDX" is a proper noun (acronym) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setName('Enable MDX file support')
				// False positive: "MDX" is a proper noun (acronym) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Process MDX files in addition to Markdown files. MDX files use the same properties format as Markdown.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableMDXSupport)
					.onChange(async (value) => {
						this.plugin.settings.enableMDXSupport = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting((setting) => {
			setting
				.setName('Show ribbon icon')
				.setDesc('Show or hide the wizard icon in the left sidebar ribbon')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showRibbonIcon)
					.onChange(async (value) => {
						this.plugin.settings.showRibbonIcon = value;
						await this.plugin.saveSettings();
						this.plugin.toggleRibbonIcon();
					}));
		});

		// Property names group
		const propertyNamesGroup = createSettingsGroup(containerEl, 'Property names', 'seo');

		propertyNamesGroup.addSetting((setting) => {
			setting
				.setName('Keyword property')
				// False positive: Contains example property names (targetKeyword, seo, keyword) which are technical notation
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Property name for target keyword (targetKeyword, seo, keyword, etc.)')
				.addText(text => {
					// False positive: "targetKeyword" is a placeholder, not UI text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text.setPlaceholder('targetKeyword');
					text.setValue(this.plugin.settings.keywordProperty);
					text.onChange(async (value) => {
						this.plugin.settings.keywordProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting((setting) => {
			setting
				.setName('Description property')
				.setDesc('Property name for meta description')
				.addText(text => {
					// False positive: "description" is a placeholder, not UI text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text.setPlaceholder('description');
					text.setValue(this.plugin.settings.descriptionProperty);
					text.onChange(async (value) => {
						this.plugin.settings.descriptionProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting((setting) => {
			setting
				.setName('Title property')
				.setDesc('Property name for title (leave blank to skip title checks)')
				.addText(text => {
					// False positive: "title" is a placeholder, not UI text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text.setPlaceholder('title');
					text.setValue(this.plugin.settings.titleProperty);
					text.onChange(async (value) => {
						this.plugin.settings.titleProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting((setting) => {
			setting
				.setName('Use file name as title')
				.setDesc('Use file name as title instead of a property')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.useFilenameAsTitle)
					.onChange(async (value) => {
						this.plugin.settings.useFilenameAsTitle = value;
						await this.plugin.saveSettings();
					}));
		});

		propertyNamesGroup.addSetting((setting) => {
			setting
				.setName('Slug property')
				.setDesc('Property name for slug (leave blank to skip slug checks)')
				.addText(text => {
					// False positive: "slug" is a placeholder, not UI text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text.setPlaceholder('slug');
					text.setValue(this.plugin.settings.slugProperty);
					text.onChange(async (value) => {
						this.plugin.settings.slugProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting((setting) => {
			setting
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
		});

		// Show parent folder option only when useFilenameAsSlug is enabled
		if (this.plugin.settings.useFilenameAsSlug) {
			propertyNamesGroup.addSetting((setting) => {
				setting
					.setName('Use parent folder name instead when specified file name is used')
					// False positive: Text is already in sentence case
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setDesc('If a markdown file matches this file name, use the parent folder name as the slug instead')
					.addText(text => {
						// False positive: "index" is a placeholder, not UI text
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						text.setPlaceholder('index');
						text.setValue(this.plugin.settings.parentFolderSlugFilename);
						text.onChange(async (value) => {
							this.plugin.settings.parentFolderSlugFilename = value;
							await this.plugin.saveSettings();
						});
					});
			});
		}

		// Audit options group
		const auditOptionsGroup = createSettingsGroup(containerEl, 'Audit options', 'seo');

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check meta title length')
				.setDesc('Enable meta title length checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkTitleLength)
					.onChange(async (value) => {
						this.plugin.settings.checkTitleLength = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check heading order')
				.setDesc('Enable heading hierarchy checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkHeadingOrder)
					.onChange(async (value) => {
						this.plugin.settings.checkHeadingOrder = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check content length')
				.setDesc('Enable content length checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkContentLength)
					.onChange(async (value) => {
						this.plugin.settings.checkContentLength = value;
						await this.plugin.saveSettings();
					}));
		});

		// Duplicate content check with performance warning
		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check duplicate content')
				.setDesc('Enable duplicate content detection')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkDuplicateContent)
					.onChange(async (value) => {
						this.plugin.settings.checkDuplicateContent = value;
						await this.plugin.saveSettings();
					}));
			// Add performance warning
			// False positive: "Warning:" is a standard warning prefix and should be capitalized
			setting.descEl.createEl('div', {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Warning: This feature can be very resource-intensive with large vaults and many notes. Disable for faster audits.',
				cls: 'setting-item-description seo-warning-message'
			});
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check alt text')
				.setDesc('Enable alt text checking for media content (images, videos, embeds, etc.)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkAltText)
					.onChange(async (value) => {
						this.plugin.settings.checkAltText = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check image file names')
				.setDesc('Enable image file name checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkImageNaming)
					.onChange(async (value) => {
						this.plugin.settings.checkImageNaming = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check broken internal links')
				.setDesc('Enable broken internal link detection')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkBrokenLinks)
					.onChange(async (value) => {
						this.plugin.settings.checkBrokenLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check external links')
				.setDesc('Return a list of external links')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkExternalLinks)
					.onChange(async (value) => {
						this.plugin.settings.checkExternalLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Enable broken external link check button')
				// False positive: Contains quoted button text which is already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
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
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check naked links')
				.setDesc('Enable naked URL detection')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkNakedLinks)
					.onChange(async (value) => {
						this.plugin.settings.checkNakedLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check reading level')
				.setDesc('Enable reading level analysis')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkReadingLevel)
					.onChange(async (value) => {
						this.plugin.settings.checkReadingLevel = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check potentially broken links')
				.setDesc('Check for potentially broken internal links that may not work on web publishing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkPotentiallyBrokenLinks)
					.onChange(async (value) => {
						this.plugin.settings.checkPotentiallyBrokenLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Check potentially broken embeds')
				// False positive: Text is already in sentence case; "wikilink-based" is technical terminology
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Check for potentially broken markdown or wikilink-based embedded media that may not work on web publishing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkPotentiallyBrokenEmbeds)
					.onChange(async (value) => {
						this.plugin.settings.checkPotentiallyBrokenEmbeds = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				.setName('Flexible relative link check')
				.setDesc('Uses flexible validation for relative paths like /page that can be resolved by a static site generator, but may be considered broken by typical Obsidian validation')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.publishMode)
					.onChange(async (value) => {
						this.plugin.settings.publishMode = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
				// False positive: "H1" is technical notation (HTML heading level) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setName('Title property is H1')
				// False positive: "H1" is technical notation (HTML heading level) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Enable when your static site generator uses the title property to automatically generate the H1 heading. This prevents H1 validation errors while still flagging H1s that appear after other heading levels.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.skipH1Check)
					.onChange(async (value) => {
						this.plugin.settings.skipH1Check = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting((setting) => {
			setting
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
			// False positive: "Warning:" is a standard warning prefix and should be capitalized
			setting.descEl.createEl('div', {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Warning: This will make vault audits extremely slow. Use the "Check external links" button instead for individual notes.',
				cls: 'setting-item-description seo-warning-message'
			});
		});

		// Thresholds group
		const thresholdsGroup = createSettingsGroup(containerEl, 'Thresholds', 'seo');

		thresholdsGroup.addSetting((setting) => {
			setting
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
		});

		thresholdsGroup.addSetting((setting) => {
			setting
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
		});

		thresholdsGroup.addSetting((setting) => {
			setting
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
		});

		thresholdsGroup.addSetting((setting) => {
			setting
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
		});
	}
}
