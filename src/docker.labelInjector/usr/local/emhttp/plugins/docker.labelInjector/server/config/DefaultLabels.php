<?php

namespace DockerInjector\Config;

class DefaultLabels
{
    public const CONFIG_PATH = "/boot/config/docker.labelInjector";
    public const LABELS_PATH = self::CONFIG_PATH . "/labels.json";
    public const QUOTE_REPLACER = "\`";

    /**
     * Save the default labels to a file.
     * @return string|null
     */
    static function formSubmit(): string|null
    {
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            $labels = array_map(function ($item) {
                return str_replace(self::QUOTE_REPLACER, '"', $item);
            }, $_POST["labels"] ?? []);
            $labelsJson = json_encode(['labels' => $labels]);
            mkdir(DefaultLabels::CONFIG_PATH, 0755, true);
            file_put_contents(DefaultLabels::LABELS_PATH, $labelsJson);
            return "Labels saved successfully!";
        }
        return null;
    }


    /**
     * Get the default labels from the config file.
     * @return string[]
     */
    static function getDefaultLabels(): array
    {
        $json = "";
        if (file_exists(self::LABELS_PATH)) {
            $json = file_get_contents(self::LABELS_PATH);
        }
        if (!$json || empty($json)) {
            return [];
        }

        $userLabels = array_map(function ($item) {
            return str_replace('"', self::QUOTE_REPLACER, $item);
        }, json_decode($json)->labels);

        return $userLabels;
    }

    /**
     * Generate the form for the default labels.
     */
    // TODO: reuse the form select config and here
    static function generateForm(): void
    {
        $message = self::formSubmit();

        echo <<<HTML
            <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #ff8c00; font-weight: bold; border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 20px;">Default Auto-Inject Presets</h2>

                <div class="label-injector-notes" style="text-align: left; background-color: var(--bg-color, #2a2a2a); border: 1px solid var(--border-color, #444); border-radius: 8px; padding: 15px 20px; margin-bottom: 20px; color: var(--text-color, #ddd);">
                    <h3 style="margin-top: 0; color: #ff8c00; font-size: 1.1em; font-weight: bold;">Configuration Notes</h3>
                    <ul class="list" style="list-style-type: disc; margin: 0 0 15px 20px; padding: 0;">
                        <li>These labels will be available as out-of-the-box presets when using the "Add Labels" UI.</li>
                        <li>Type and press <strong>Enter</strong> to save a new preset label.</li>
                        <li>Separate label from value via <code>=</code> (e.g. <code>MY_LABEL=VALUE</code>). Empty values are valid.</li>
                        <li>To use quotes, you must use an escaped backtick (<code>\</code>`<code></code>).</li>
                    </ul>

                    <h3 style="margin-top: 15px; color: #ff8c00; font-size: 1.1em; font-weight: bold;">Available Dynamic Variables</h3>
                    <ul class="list" style="list-style-type: disc; margin: 0 0 0 20px; padding: 0;">
                        <li><code>\${CONTAINER_NAME}</code> - i.e. <i>'LABEL_A=\${CONTAINER_NAME}.domain.com' -> 'LABEL_A=container_A.domain.com'</i></li>
                        <li><code>\${CONTAINER_NAME_LOWER}</code> - Lowercase container name</li>
                        <li><code>\${CONTAINER_PORT}</code> - Auto-detected primary internal port</li>
                    </ul>
                </div>

                <form id="default-label-form" method="post" action="" style="margin-top: 20px;">
                    <div style="margin-bottom: 15px;">
                        <label for="labels" style="display: block; font-weight: bold; margin-bottom: 8px; color: var(--text-color, #eee);">Active Presets</label>
                        <select multiple type="text" id="labels" name="labels[]" class="label-injector-select" style="width: 100%;">
        HTML;

        $labels = self::getDefaultLabels();
        foreach ($labels as $label) {
            echo "<option selected value='$label'>$label</option>";
        }

        echo <<<HTML
                        </select>
                    </div>
                    <button type="submit" style="background-color: #ff8c00; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 4px; cursor: pointer;">Save Presets</button>
                </form>
        HTML;

        if (isset($message)) {
            echo "<p style='margin-top: 15px; padding: 10px; background-color: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; border-radius: 4px;'>$message</p>";
        }
        echo "</div>";
    }
}

?>