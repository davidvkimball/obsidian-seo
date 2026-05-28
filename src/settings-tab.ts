import { App, PluginSettingTab, Setting, SettingGroup } from "obsidian";
import SEOPlugin from "./main";


export class SEOSettingTab extends PluginSettingTab {
	plugin: SEOPlugin;
	public icon = 'lucide-search-check';

	constructor(app: App, plugin: SEOPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// 1.13.0+: framework calls this and skips display().
	// Pre-1.13.0: this method is not invoked; display() below runs as before.
	// See https://docs.obsidian.md/plugins/guides/migrate-declarative-settings
	getSettingDefinitions() {
		return [
			{
				type: 'group' as const,
				heading: 'Global',
				items: [
					{
						name: 'Scan directories',
						desc: 'Comma-separated list of directory names to scan. Leave blank to scan all directories.',
						control: { type: 'text' as const, key: 'scanDirectories', placeholder: 'Like blog, posts, public' },
					},
					{
						name: 'Use note titles instead of file names',
						desc: 'Display note titles from properties instead of file names in the issues list and current note audit',
						control: { type: 'toggle' as const, key: 'useNoteTitles' },
					},
					{
						name: 'Title prefix / suffix',
						desc: 'Specify an optional prefix or suffix that gets appended to your meta title - used to factor in character count for the title length check',
						control: { type: 'text' as const, key: 'titlePrefixSuffix', placeholder: 'Author name' },
					},
					{
						name: 'Ignores files with an underscore prefix',
						desc: "Don't process files that begin with an underscore, like _example.md",
						control: { type: 'toggle' as const, key: 'ignoreUnderscoreFiles' },
					},
					{
						// False positive: "MDX" is a proper noun (acronym) and should be capitalized
						name: 'Enable MDX file support',
						// False positive: "MDX" is a proper noun (acronym) and should be capitalized
						desc: 'Process MDX files in addition to Markdown files. MDX files use the same properties format as Markdown.',
						control: { type: 'toggle' as const, key: 'enableMDXSupport' },
					},
					{
						name: 'Show ribbon icon',
						desc: 'Show or hide the wizard icon in the left sidebar ribbon',
						// Render: changing this value has a side effect (ribbon DOM update).
						render: (setting: Setting) => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.showRibbonIcon)
								.onChange(async value => {
									this.plugin.settings.showRibbonIcon = value;
									await this.plugin.saveSettings();
									this.plugin.toggleRibbonIcon();
								}));
						},
					},
					{
						name: 'Export format',
						desc: 'Format for copy and download from the audit panel (CSV or Markdown). Markdown is useful for pasting into agents or docs.',
						control: {
							type: 'dropdown' as const,
							key: 'exportFormat',
							options: { csv: 'CSV', markdown: 'Markdown' },
						},
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Property names',
				items: [
					{
						name: 'Keyword property',
						desc: 'Property name for target keyword (targetKeyword, SEO, keyword, etc.)',
						// False positive: "targetKeyword" is a placeholder, not UI text
						control: { type: 'text' as const, key: 'keywordProperty', placeholder: 'targetKeyword' },
					},
					{
						name: 'Description property',
						desc: 'Property name for meta description',
						control: { type: 'text' as const, key: 'descriptionProperty', placeholder: 'Description' },
					},
					{
						name: 'Title property',
						desc: 'Property name for title (leave blank to skip title checks)',
						control: { type: 'text' as const, key: 'titleProperty', placeholder: 'Title' },
					},
					{
						name: 'Use file name as title',
						desc: 'Use file name as title instead of a property',
						control: { type: 'toggle' as const, key: 'useFilenameAsTitle' },
					},
					{
						name: 'Slug property',
						desc: 'Property name for slug (leave blank to skip slug checks)',
						control: { type: 'text' as const, key: 'slugProperty', placeholder: 'Slug' },
					},
					{
						name: 'Use file/folder name as slug',
						desc: 'Use file/folder name as slug instead of a property',
						control: { type: 'toggle' as const, key: 'useFilenameAsSlug' },
					},
					{
						name: 'Use parent folder name instead when specified file name is used',
						desc: 'If a Markdown file matches this file name, use the parent folder name as the slug instead',
						visible: () => this.plugin.settings.useFilenameAsSlug,
						control: { type: 'text' as const, key: 'parentFolderSlugFilename', placeholder: 'Index' },
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Audit options',
				items: [
					{
						name: 'Check meta title length',
						desc: 'Enable meta title length checking',
						control: { type: 'toggle' as const, key: 'checkTitleLength' },
					},
					{
						name: 'Check heading order',
						desc: 'Enable heading hierarchy checking',
						control: { type: 'toggle' as const, key: 'checkHeadingOrder' },
					},
					{
						name: 'Check content length',
						desc: 'Enable content length checking',
						control: { type: 'toggle' as const, key: 'checkContentLength' },
					},
					{
						name: 'Check duplicate content',
						desc: 'Enable duplicate content detection',
						// Render: simple bind plus inline warning sub-text appended to descEl.
						render: (setting: Setting) => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.checkDuplicateContent)
								.onChange(async value => {
									this.plugin.settings.checkDuplicateContent = value;
									await this.plugin.saveSettings();
								}));
							// False positive: "Warning:" is a standard warning prefix and should be capitalized
							setting.descEl.createEl('div', {
								text: 'Warning: This feature can be very resource-intensive with large vaults and many notes. Disable for faster audits.',
								cls: 'setting-item-description seo-warning-message',
							});
						},
					},
					{
						name: 'Check alt text',
						desc: 'Enable alt text checking for media content (images, videos, embeds, etc.)',
						control: { type: 'toggle' as const, key: 'checkAltText' },
					},
					{
						name: 'Check image file names',
						desc: 'Enable image file name checking',
						control: { type: 'toggle' as const, key: 'checkImageNaming' },
					},
					{
						name: 'Check broken internal links',
						desc: 'Enable broken internal link detection',
						control: { type: 'toggle' as const, key: 'checkBrokenLinks' },
					},
					{
						name: 'Check external links',
						desc: 'Return a list of external links',
						control: { type: 'toggle' as const, key: 'checkExternalLinks' },
					},
					{
						name: 'Enable broken external link check button',
						// False positive: Contains quoted button text which is already in sentence case
						desc: 'Show "Check external links for 404s" button in current note panel',
						// Render: changing this value has a side effect (side panel refresh).
						render: (setting: Setting) => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.enableExternalLinkButton)
								.onChange(async value => {
									this.plugin.settings.enableExternalLinkButton = value;
									await this.plugin.saveSettings();
									if (this.plugin.sidePanel) {
										this.plugin.sidePanel.refresh();
									}
								}));
						},
					},
					{
						name: 'Check naked links',
						desc: 'Enable naked URL detection',
						control: { type: 'toggle' as const, key: 'checkNakedLinks' },
					},
					{
						name: 'Check reading level',
						desc: 'Enable reading level analysis',
						control: { type: 'toggle' as const, key: 'checkReadingLevel' },
					},
					{
						name: 'Check potentially broken links',
						desc: 'Check for potentially broken internal links that may not work on web publishing',
						control: { type: 'toggle' as const, key: 'checkPotentiallyBrokenLinks' },
					},
					{
						name: 'Check potentially broken embeds',
						desc: 'Check for potentially broken Markdown or wikilink-based embedded media that may not work on web publishing',
						control: { type: 'toggle' as const, key: 'checkPotentiallyBrokenEmbeds' },
					},
					{
						name: 'Flexible relative link check',
						desc: 'Uses flexible validation for relative paths like /page that can be resolved by a static site generator, but may be considered broken by typical Obsidian validation',
						control: { type: 'toggle' as const, key: 'publishMode' },
					},
					{
						name: 'Title property is H1',
						desc: 'Enable when your static site generator uses the title property to automatically generate the H1 heading. This prevents H1 validation errors while still flagging additional H1 headings that appear after other heading levels.',
						control: { type: 'toggle' as const, key: 'skipH1Check' },
					},
					{
						name: 'Automatically include broken external link checks in audits (not recommended)',
						desc: 'Include broken external link checking in vault-wide and current note audits',
						// Render: side effect (side panel refresh) plus inline warning sub-text.
						render: (setting: Setting) => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.enableExternalLinkVaultCheck)
								.onChange(async value => {
									this.plugin.settings.enableExternalLinkVaultCheck = value;
									await this.plugin.saveSettings();
									if (this.plugin.sidePanel) {
										this.plugin.sidePanel.refresh();
									}
								}));
							// False positive: "Warning:" is a standard warning prefix and should be capitalized
							setting.descEl.createEl('div', {
								text: 'Warning: This will make vault audits extremely slow. Use the "Check external links" button instead for individual notes.',
								cls: 'setting-item-description seo-warning-message',
							});
						},
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Thresholds',
				items: [
					{
						name: 'Minimum content length',
						desc: 'Minimum word count for content length check',
						control: { type: 'number' as const, key: 'minContentLength', placeholder: '300', min: 0 },
					},
					{
						name: 'Keyword density minimum',
						desc: 'Minimum keyword density percentage',
						control: { type: 'number' as const, key: 'keywordDensityMin', placeholder: '1', min: 0 },
					},
					{
						name: 'Keyword density maximum',
						desc: 'Maximum keyword density percentage',
						control: { type: 'number' as const, key: 'keywordDensityMax', placeholder: '2', min: 0 },
					},
					{
						name: 'Duplicate content threshold',
						desc: 'Similarity percentage threshold for duplicate content detection',
						control: { type: 'number' as const, key: 'duplicateThreshold', placeholder: '80', min: 0, max: 100 },
					},
				],
			},
		];
	}

	// Override the framework's default setControlValue (which only calls saveData)
	// so that every change runs the plugin's saveSettings() — which also clears
	// the SEO cache. Without this override, cache would go stale on setting change
	// on Obsidian 1.13.0+. (On older versions this method is unused; display()
	// already calls saveSettings() in its onChange handlers.)
	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Global group
		const globalGroup = new SettingGroup(containerEl).setHeading('Global');

		globalGroup.addSetting(setting => {
			setting
				.setName('Scan directories')
				.setDesc('Comma-separated list of directory names to scan. Leave blank to scan all directories.')
				.addText(text => {
					text.setPlaceholder('Like blog, posts, public');
					text.setValue(this.plugin.settings.scanDirectories);
					text.onChange(async value => {
						this.plugin.settings.scanDirectories = value;
						await this.plugin.saveSettings();
					});
				});
		});

		globalGroup.addSetting(setting => {
			setting
				.setName('Use note titles instead of file names')
				.setDesc('Display note titles from properties instead of file names in the issues list and current note audit')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.useNoteTitles)
					.onChange(async value => {
						this.plugin.settings.useNoteTitles = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting(setting => {
			setting
				.setName('Title prefix / suffix')
				.setDesc('Specify an optional prefix or suffix that gets appended to your meta title - used to factor in character count for the title length check')
				.addText(text => text
					.setPlaceholder('Author name')
					.setValue(this.plugin.settings.titlePrefixSuffix)
					.onChange(async value => {
						this.plugin.settings.titlePrefixSuffix = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting(setting => {
			setting
				.setName('Ignores files with an underscore prefix')
				.setDesc('Don\'t process files that begin with an underscore, like _example.md')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.ignoreUnderscoreFiles)
					.onChange(async value => {
						this.plugin.settings.ignoreUnderscoreFiles = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting(setting => {
			setting
				// False positive: "MDX" is a proper noun (acronym) and should be capitalized
				.setName('Enable MDX file support')
				// False positive: "MDX" is a proper noun (acronym) and should be capitalized
				.setDesc('Process MDX files in addition to Markdown files. MDX files use the same properties format as Markdown.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableMDXSupport)
					.onChange(async value => {
						this.plugin.settings.enableMDXSupport = value;
						await this.plugin.saveSettings();
					}));
		});

		globalGroup.addSetting(setting => {
			setting
				.setName('Show ribbon icon')
				.setDesc('Show or hide the wizard icon in the left sidebar ribbon')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showRibbonIcon)
					.onChange(async value => {
						this.plugin.settings.showRibbonIcon = value;
						await this.plugin.saveSettings();
						this.plugin.toggleRibbonIcon();
					}));
		});

		globalGroup.addSetting(setting => {
			setting
				.setName('Export format')
				.setDesc('Format for copy and download from the audit panel (CSV or Markdown). Markdown is useful for pasting into agents or docs.')
				.addDropdown(dropdown => dropdown
					.addOption('csv', 'CSV')
					.addOption('markdown', 'Markdown')
					.setValue(this.plugin.settings.exportFormat)
					.onChange(async value => {
						this.plugin.settings.exportFormat = value as 'csv' | 'markdown';
						await this.plugin.saveSettings();
					}));
		});

		// Property names group
		const propertyNamesGroup = new SettingGroup(containerEl).setHeading('Property names');

		propertyNamesGroup.addSetting(setting => {
			setting
				.setName('Keyword property')
				.setDesc('Property name for target keyword (targetKeyword, SEO, keyword, etc.)')
				.addText(text => {
					// False positive: "targetKeyword" is a placeholder, not UI text
					text.setPlaceholder('targetKeyword');
					text.setValue(this.plugin.settings.keywordProperty);
					text.onChange(async value => {
						this.plugin.settings.keywordProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting(setting => {
			setting
				.setName('Description property')
				.setDesc('Property name for meta description')
				.addText(text => {
					text.setPlaceholder('Description');
					text.setValue(this.plugin.settings.descriptionProperty);
					text.onChange(async value => {
						this.plugin.settings.descriptionProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting(setting => {
			setting
				.setName('Title property')
				.setDesc('Property name for title (leave blank to skip title checks)')
				.addText(text => {
					text.setPlaceholder('Title');
					text.setValue(this.plugin.settings.titleProperty);
					text.onChange(async value => {
						this.plugin.settings.titleProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting(setting => {
			setting
				.setName('Use file name as title')
				.setDesc('Use file name as title instead of a property')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.useFilenameAsTitle)
					.onChange(async value => {
						this.plugin.settings.useFilenameAsTitle = value;
						await this.plugin.saveSettings();
					}));
		});

		propertyNamesGroup.addSetting(setting => {
			setting
				.setName('Slug property')
				.setDesc('Property name for slug (leave blank to skip slug checks)')
				.addText(text => {
					text.setPlaceholder('Slug');
					text.setValue(this.plugin.settings.slugProperty);
					text.onChange(async value => {
						this.plugin.settings.slugProperty = value;
						await this.plugin.saveSettings();
					});
				});
		});

		propertyNamesGroup.addSetting(setting => {
			setting
				.setName('Use file/folder name as slug')
				.setDesc('Use file/folder name as slug instead of a property')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.useFilenameAsSlug)
					.onChange(async value => {
						this.plugin.settings.useFilenameAsSlug = value;
						await this.plugin.saveSettings();
						// Re-render to show/hide the parent folder option
						this.display();
					}));
		});

		// Show parent folder option only when useFilenameAsSlug is enabled
		if (this.plugin.settings.useFilenameAsSlug) {
			propertyNamesGroup.addSetting(setting => {
				setting
					.setName('Use parent folder name instead when specified file name is used')
					.setDesc('If a Markdown file matches this file name, use the parent folder name as the slug instead')
					.addText(text => {
						text.setPlaceholder('Index');
						text.setValue(this.plugin.settings.parentFolderSlugFilename);
						text.onChange(async value => {
							this.plugin.settings.parentFolderSlugFilename = value;
							await this.plugin.saveSettings();
						});
					});
			});
		}

		// Audit options group
		const auditOptionsGroup = new SettingGroup(containerEl).setHeading('Audit options');

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check meta title length')
				.setDesc('Enable meta title length checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkTitleLength)
					.onChange(async value => {
						this.plugin.settings.checkTitleLength = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check heading order')
				.setDesc('Enable heading hierarchy checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkHeadingOrder)
					.onChange(async value => {
						this.plugin.settings.checkHeadingOrder = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check content length')
				.setDesc('Enable content length checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkContentLength)
					.onChange(async value => {
						this.plugin.settings.checkContentLength = value;
						await this.plugin.saveSettings();
					}));
		});

		// Duplicate content check with performance warning
		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check duplicate content')
				.setDesc('Enable duplicate content detection')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkDuplicateContent)
					.onChange(async value => {
						this.plugin.settings.checkDuplicateContent = value;
						await this.plugin.saveSettings();
					}));
			// Add performance warning
			// False positive: "Warning:" is a standard warning prefix and should be capitalized
			setting.descEl.createEl('div', {
				 
				text: 'Warning: This feature can be very resource-intensive with large vaults and many notes. Disable for faster audits.',
				cls: 'setting-item-description seo-warning-message'
			});
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check alt text')
				.setDesc('Enable alt text checking for media content (images, videos, embeds, etc.)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkAltText)
					.onChange(async value => {
						this.plugin.settings.checkAltText = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check image file names')
				.setDesc('Enable image file name checking')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkImageNaming)
					.onChange(async value => {
						this.plugin.settings.checkImageNaming = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check broken internal links')
				.setDesc('Enable broken internal link detection')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkBrokenLinks)
					.onChange(async value => {
						this.plugin.settings.checkBrokenLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check external links')
				.setDesc('Return a list of external links')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkExternalLinks)
					.onChange(async value => {
						this.plugin.settings.checkExternalLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Enable broken external link check button')
				// False positive: Contains quoted button text which is already in sentence case
				.setDesc('Show "Check external links for 404s" button in current note panel')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableExternalLinkButton)
					.onChange(async value => {
						this.plugin.settings.enableExternalLinkButton = value;
						await this.plugin.saveSettings();
						// Refresh the side panel if it exists
						if (this.plugin.sidePanel) {
							this.plugin.sidePanel.refresh();
						}
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check naked links')
				.setDesc('Enable naked URL detection')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkNakedLinks)
					.onChange(async value => {
						this.plugin.settings.checkNakedLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check reading level')
				.setDesc('Enable reading level analysis')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkReadingLevel)
					.onChange(async value => {
						this.plugin.settings.checkReadingLevel = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check potentially broken links')
				.setDesc('Check for potentially broken internal links that may not work on web publishing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkPotentiallyBrokenLinks)
					.onChange(async value => {
						this.plugin.settings.checkPotentiallyBrokenLinks = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Check potentially broken embeds')
				.setDesc('Check for potentially broken Markdown or wikilink-based embedded media that may not work on web publishing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.checkPotentiallyBrokenEmbeds)
					.onChange(async value => {
						this.plugin.settings.checkPotentiallyBrokenEmbeds = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Flexible relative link check')
				.setDesc('Uses flexible validation for relative paths like /page that can be resolved by a static site generator, but may be considered broken by typical Obsidian validation')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.publishMode)
					.onChange(async value => {
						this.plugin.settings.publishMode = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Title property is H1')
				.setDesc('Enable when your static site generator uses the title property to automatically generate the H1 heading. This prevents H1 validation errors while still flagging additional H1 headings that appear after other heading levels.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.skipH1Check)
					.onChange(async value => {
						this.plugin.settings.skipH1Check = value;
						await this.plugin.saveSettings();
					}));
		});

		auditOptionsGroup.addSetting(setting => {
			setting
				.setName('Automatically include broken external link checks in audits (not recommended)')
				.setDesc('Include broken external link checking in vault-wide and current note audits')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableExternalLinkVaultCheck)
					.onChange(async value => {
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
				text: 'Warning: This will make vault audits extremely slow. Use the "Check external links" button instead for individual notes.',
				cls: 'setting-item-description seo-warning-message'
			});
		});

		// Thresholds group
		const thresholdsGroup = new SettingGroup(containerEl).setHeading('Thresholds');

		thresholdsGroup.addSetting(setting => {
			setting
				.setName('Minimum content length')
				.setDesc('Minimum word count for content length check')
				.addText(text => text
					.setPlaceholder('300')
					.setValue(this.plugin.settings.minContentLength.toString())
					.onChange(async value => {
						const num = parseInt(value);
						if (!isNaN(num)) {
							this.plugin.settings.minContentLength = num;
							await this.plugin.saveSettings();
						}
					}));
		});

		thresholdsGroup.addSetting(setting => {
			setting
				.setName('Keyword density minimum')
				.setDesc('Minimum keyword density percentage')
				.addText(text => text
					.setPlaceholder('1')
					.setValue(this.plugin.settings.keywordDensityMin.toString())
					.onChange(async value => {
						const num = parseFloat(value);
						if (!isNaN(num)) {
							this.plugin.settings.keywordDensityMin = num;
							await this.plugin.saveSettings();
						}
					}));
		});

		thresholdsGroup.addSetting(setting => {
			setting
				.setName('Keyword density maximum')
				.setDesc('Maximum keyword density percentage')
				.addText(text => text
					.setPlaceholder('2')
					.setValue(this.plugin.settings.keywordDensityMax.toString())
					.onChange(async value => {
						const num = parseFloat(value);
						if (!isNaN(num)) {
							this.plugin.settings.keywordDensityMax = num;
							await this.plugin.saveSettings();
						}
					}));
		});

		thresholdsGroup.addSetting(setting => {
			setting
				.setName('Duplicate content threshold')
				.setDesc('Similarity percentage threshold for duplicate content detection')
				.addText(text => text
					.setPlaceholder('80')
					.setValue(this.plugin.settings.duplicateThreshold.toString())
					.onChange(async value => {
						const num = parseInt(value);
						if (!isNaN(num)) {
							this.plugin.settings.duplicateThreshold = num;
							await this.plugin.saveSettings();
						}
					}));
		});
	}
}
