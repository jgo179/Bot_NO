import { Command, Component } from "@/discord/base";
import { brBuilder, createModalInput, createRow } from "@magicyan/discord";
import { ApplicationCommandOptionType, ApplicationCommandType, Attachment, AttachmentBuilder, ButtonBuilder, ButtonStyle, Collection, ComponentType, ModalBuilder, TextInputStyle, codeBlock } from "discord.js";

interface MessageProps {
  roleId: string,
  image: Attachment | null
}
const members: Collection<string, MessageProps> = new Collection();

new Command({
  name: "privado",
  description: "Comando de anúncios",
  dmPermission: false,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "cargo",
      description: "Cargo que receberá a mensagem",
      type: ApplicationCommandOptionType.Role,
      required,
    },
    {
      name: "imagem",
      description: "Imagem anexada no anúncio",
      type: ApplicationCommandOptionType.Attachment,
    }
  ],
  async run(interaction) {
    const { options, member } = interaction;

    const role = options.getRole("cargo", true);
    const image = options.getAttachment("imagem");

    members.set(member.id, { roleId: role.id, image });

    await interaction.showModal(new ModalBuilder({
      customId: "announcement-modal-private",
      title: "Fazer um anúncio",
      components: [
        createModalInput({
          customId: "announcement-title-input",
          label: "Título",
          placeholder: "Insira o título",
          style: TextInputStyle.Short,
          minLength: 4,
          maxLength: 256,
        }),
        createModalInput({
          customId: "announcement-description-input",
          label: "Mensagem",
          placeholder: "Insira a mensagem",
          style: TextInputStyle.Paragraph,
          minLength: 10,
          maxLength: 4000
        })
      ]
    }));
  }
});

new Component({
  customId: "announcement-modal-private",
  type: "Modal", cache: "cached",
  async run(interaction) {
    const { fields, guild, member } = interaction;

    const messageProps = members.get(member.id);
    if (!messageProps) {
      interaction.reply({
        ephemeral,
        content: "Não foi possível obter os dados iniciais! Utilize o comando novamente."
      });
      return;
    }

    const title = fields.getTextInputValue("announcement-title-input");
    const description = fields.getTextInputValue("announcement-description-input");

    const msg = `**${title}**\n${description}`;

    await interaction.deferReply({ fetchReply });

    const files: AttachmentBuilder[] = [];

    if (messageProps.image) {
      files.push(new AttachmentBuilder(messageProps.image.url, { name: "image.png" }));
    }

    const message = await interaction.editReply({
      content: msg,
      files,
      components: [
        createRow(
          new ButtonBuilder({
            customId: "announcement-confirm-button", style: ButtonStyle.Success,
            label: "Confirmar"
          }),
          new ButtonBuilder({
            customId: "announcement-cancel-button", style: ButtonStyle.Danger,
            label: "Cancelar"
          })
        )
      ]
    });

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button });
    collector.on("collect", async (subInteraction) => {
      const { customId } = subInteraction;
      collector.stop();

      if (customId === "announcement-cancel-button") {
        subInteraction.update({
          components, files: [],
          content: "Ação cancelada!"
        });
        return;
      }
      await subInteraction.deferUpdate();

      const roleId = messageProps.roleId;
      guild.members.cache.forEach(member => {
        if (member.roles.cache.has(roleId))
          member.send({
            content: msg, files
          })
            .then(msgs => {
              interaction.editReply({
                components, files: [],
                content: `Mensagem enviada com sucesso para <@&${roleId}>! Confira: ${msgs.url}\n||${msg}||`
              });
            })
            .catch(err => {
              interaction.editReply({
                components, files: [],
                content: brBuilder(" Não foi possível enviar a mensagem", codeBlock("bash", err))
              });
            });
      });

      members.delete(member.id);
    });
  },
});