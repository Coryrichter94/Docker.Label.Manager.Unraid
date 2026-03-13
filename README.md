# docker.labelInjector

Install via CA Apps

You can add defaults to be prefilled each time via the settings page
![settings](images/settings.png)

After installing, just click the "Add Labels" button

![button](images/button.png)

Then simply choose the containers you want to add the label value combos to, to choose All for all.

If the label exists already an update will be performed.

If the label does not exist it will be added.

If you enter a value of `REMOVE` it will instead remove the label if found.

Special flags include:

These will be replaced with the magic values (works with both key and value):

* `${CONTAINER_NAME}`
* `${CONTAINER_NAME_LOWER}` (lowercase name)
* `${CONTAINER_PORT}` (auto-detects the first internal port configured in the container)

### Presets
Out of the box, the plugin provides default configurations to quickly configure your containers for:
* **Nginx Proxy Manager Plus (NPM)**
* **Homepage**
* **AutoKuma**

Before it updates it will backup the template being used just incase something does go wrong.
![form](images/form.png)

If you find this happen you should be able to restore the backup directly via the **Undo / Restore** button next to the "Add Labels" button, or manually via `/boot/config/plugins/dockerMan/templates-user/my-TEMPLATE_NAME.DATE.bak`.
