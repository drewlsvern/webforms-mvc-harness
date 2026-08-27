<%@ Page Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true" CodeBehind="OrderEdit.aspx.cs" Inherits="WebFormsSample.Orders.OrderEdit" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <asp:Button ID="btnCancel" runat="server" Text="Cancel" PostBackUrl="~/Orders/OrderList.aspx" />
</asp:Content>
