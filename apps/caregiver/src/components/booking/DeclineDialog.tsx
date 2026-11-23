import React from "react";

import ConfirmDialog from "@/src/components/ui/confirm-dialog";
import Image from "@/src/components/ui/image";
import {
  DECLINE_CANCEL,
  DECLINE_CONFIRM,
  DECLINE_FINAL_NOTICE,
  DECLINE_MESSAGE,
  DECLINE_TITLE,
} from "@/src/constants/offerCopy";

/** "Are you sure you want to decline this booking ?": one dialog for Home and the Bookings tab. */
const DeclineDialog: React.FC<{ visible: boolean; onClose: () => void; onConfirm: () => void }> = ({ visible, onClose, onConfirm }) => (
  <ConfirmDialog
    visible={visible}
    onClose={onClose}
    illustration={<Image source={require("@/assets/images/pngs/calendar-remove.png")} style={{ width: 96, height: 96 }} />}
    title={DECLINE_TITLE}
    body={DECLINE_MESSAGE}
    notice={DECLINE_FINAL_NOTICE}
    cancelLabel={DECLINE_CANCEL}
    confirmLabel={DECLINE_CONFIRM}
    onConfirm={onConfirm}
  />
);

export default DeclineDialog;
