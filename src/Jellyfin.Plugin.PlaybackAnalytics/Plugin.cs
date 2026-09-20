using Jellyfin.Plugin.PlaybackAnalytics.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.PlaybackAnalytics;

/// <summary>
/// Playback Analytics plugin entry point.
/// </summary>
public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Jellyfin application paths.</param>
    /// <param name="xmlSerializer">Jellyfin XML serializer.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "Playback Analytics";

    /// <inheritdoc />
    public override string Description =>
        "Library-wide playback and storage analytics using Jellyfin and Playback Reporting.";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("74c7cfb4-0b86-4615-bb46-a5144230a638");

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        var resourcePrefix = GetType().Namespace + ".Configuration.";

        return
        [
            new PluginPageInfo
            {
                Name = "playback-analytics",
                DisplayName = "Playback Analytics",
                EmbeddedResourcePath = resourcePrefix + "playbackAnalytics.html",
                EnableInMainMenu = true
            },
            new PluginPageInfo
            {
                Name = "playback-analytics.js",
                EmbeddedResourcePath = resourcePrefix + "playbackAnalytics.js"
            }
        ];
    }
}
